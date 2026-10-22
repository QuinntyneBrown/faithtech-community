import { EditorSpan, normalise } from './editor-model';

/** How a page link shows: its text and icon, and where it goes (null for "Private page", L2-090 AC3). */
export interface PageLinkView {
  text: string;
  icon: string | null;
  href: string | null;
}

export type PageLinkResolver = (span: EditorSpan) => PageLinkView;

const defaultPageLink: PageLinkResolver = (span) => ({
  text: span.text || 'Private page',
  icon: null,
  href: span.pageId ? `/notes/${span.pageId}` : null,
});

/**
 * Builds the DOM for a block's runs with createElement and text nodes only, never innerHTML, so typed or pasted
 * text can never become markup (ADR 0024). Line breaks stay "\n" characters under `white-space: pre-wrap`.
 */
export function renderSpans(
  el: HTMLElement,
  spans: readonly EditorSpan[],
  options: { editable: boolean; pageLink?: PageLinkResolver } = { editable: true },
): void {
  const doc = el.ownerDocument;
  el.replaceChildren();
  for (const span of spans) {
    if (span.pageId) {
      el.append(pageLinkElement(doc, span, options.editable, options.pageLink ?? defaultPageLink));
      continue;
    }
    let node: Node = doc.createTextNode(span.text);
    const wrap = (tag: string) => {
      const outer = doc.createElement(tag);
      outer.append(node);
      node = outer;
    };
    if (span.code) wrap('code');
    if (span.strike) wrap('s');
    if (span.underline) wrap('u');
    if (span.italic) wrap('em');
    if (span.bold) wrap('strong');
    if (span.href) {
      const a = doc.createElement('a');
      a.href = span.href;
      if (span.href.startsWith('https://')) {
        a.target = '_blank';
        a.rel = 'noopener';
      }
      a.append(node);
      if (!options.editable && span.href.startsWith('https://')) {
        const hint = doc.createElement('span');
        hint.className = 'visually-hidden';
        hint.textContent = ' (opens in a new tab)';
        hint.setAttribute('data-hint', '');
        a.append(hint);
      }
      node = a;
    }
    el.append(node);
  }
}

function pageLinkElement(
  doc: Document,
  span: EditorSpan,
  editable: boolean,
  resolve: PageLinkResolver,
): HTMLElement {
  const view = resolve(span);
  const link = doc.createElement(view.href ? 'a' : 'span');
  link.className = view.href ? 'page-link' : 'page-link page-link--private';
  link.setAttribute('data-page-id', span.pageId!);
  if (view.icon) link.setAttribute('data-icon', view.icon);
  if (view.href) link.setAttribute('href', view.href);
  if (editable) link.setAttribute('contenteditable', 'false');
  link.textContent = view.text;
  return link;
}

type Marks = Omit<EditorSpan, 'text' | 'pageId'>;

/** Reads a text box's DOM back into runs: the inverse of {@link renderSpans}, tolerant of browser markup. */
export function readSpans(el: HTMLElement): EditorSpan[] {
  const out: EditorSpan[] = [];
  const walk = (node: Node, marks: Marks) => {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.textContent) out.push({ text: node.textContent, ...marks });
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    if (node.hasAttribute('data-hint')) return;
    if (node.dataset['pageId']) {
      out.push({ text: node.textContent ?? '', pageId: node.dataset['pageId'] });
      return;
    }
    if (node.tagName === 'BR') {
      out.push({ text: '\n', ...marks });
      return;
    }
    const next = { ...marks };
    switch (node.tagName) {
      case 'STRONG':
      case 'B':
        next.bold = true;
        break;
      case 'EM':
      case 'I':
        next.italic = true;
        break;
      case 'U':
        next.underline = true;
        break;
      case 'S':
      case 'STRIKE':
      case 'DEL':
        next.strike = true;
        break;
      case 'CODE':
        next.code = true;
        break;
      case 'A':
        if (node.getAttribute('href')) next.href = node.getAttribute('href');
        break;
    }
    const block = node.tagName === 'DIV' || node.tagName === 'P';
    if (block && out.length > 0 && !out[out.length - 1].text.endsWith('\n'))
      out.push({ text: '\n', ...marks });
    node.childNodes.forEach((child) => walk(child, next));
  };
  el.childNodes.forEach((child) => walk(child, {}));
  // A lone trailing <br> is how browsers keep an empty line open; it is not content.
  const spans = normalise(out);
  const last = spans[spans.length - 1];
  if (last && !last.pageId && last.text === '\n') spans.pop();
  return spans;
}

/** The caret's (or a selection end's) character offset within the text box, or null when it is outside. */
export function caretOffset(el: HTMLElement, end: 'start' | 'end' = 'start'): number | null {
  const selection = el.ownerDocument.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  const container = end === 'start' ? range.startContainer : range.endContainer;
  if (!el.contains(container)) return null;
  const before = el.ownerDocument.createRange();
  before.selectNodeContents(el);
  before.setEnd(container, end === 'start' ? range.startOffset : range.endOffset);
  return visibleLength(before);
}

/** The selection within the text box as character offsets. */
export function selectionOffsets(el: HTMLElement): { start: number; end: number } | null {
  const start = caretOffset(el, 'start');
  const end = caretOffset(el, 'end');
  return start === null || end === null ? null : { start, end };
}

function visibleLength(range: Range): number {
  const fragment = range.cloneContents();
  fragment.querySelectorAll('[data-hint]').forEach((hint) => hint.remove());
  return fragment.textContent?.length ?? 0;
}

/** Puts the caret at a character offset (or selects between two), stepping over page links whole. */
export function setSelection(el: HTMLElement, start: number, end = start): void {
  const doc = el.ownerDocument;
  const range = doc.createRange();
  const startPoint = pointAt(el, start);
  const endPoint = end === start ? startPoint : pointAt(el, end);
  range.setStart(startPoint.node, startPoint.offset);
  range.setEnd(endPoint.node, endPoint.offset);
  const selection = doc.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function pointAt(el: HTMLElement, offset: number): { node: Node; offset: number } {
  let left = offset;
  const children = Array.from(el.childNodes);
  for (const child of flatten(children)) {
    if (child instanceof HTMLElement) {
      // A page link: the caret goes before or after it, never inside.
      const length = child.textContent?.length ?? 0;
      const parent = child.parentNode!;
      const index = Array.from(parent.childNodes).indexOf(child);
      if (left === 0) return { node: parent, offset: index };
      if (left <= length) return { node: parent, offset: index + 1 };
      left -= length;
      continue;
    }
    const length = child.textContent?.length ?? 0;
    if (left <= length) return { node: child, offset: left };
    left -= length;
  }
  return { node: el, offset: el.childNodes.length };
}

/** Text nodes in order, with page links and hints as single atoms. */
function flatten(nodes: Node[]): Node[] {
  const out: Node[] = [];
  for (const node of nodes) {
    if (node.nodeType === Node.TEXT_NODE) out.push(node);
    else if (node instanceof HTMLElement) {
      if (node.hasAttribute('data-hint')) continue;
      if (node.dataset['pageId']) out.push(node);
      else out.push(...flatten(Array.from(node.childNodes)));
    }
  }
  return out;
}

/** The caret's position on screen, for placing the slash menu and suggestions. */
export function caretRect(el: HTMLElement): DOMRect {
  const selection = el.ownerDocument.getSelection();
  if (selection && selection.rangeCount > 0 && el.contains(selection.anchorNode)) {
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    if (rect.width || rect.height || rect.x || rect.y) return rect;
  }
  return el.getBoundingClientRect();
}
