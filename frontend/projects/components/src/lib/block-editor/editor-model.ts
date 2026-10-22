/*
 * The block editor's model (design system, block editor; ADR 0023, ADR 0024). The shapes match the notes API's
 * blocks and spans structurally, so a page passes its blocks straight in; the library itself knows no API.
 */

export type EditorBlockType =
  | 'paragraph'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'bulleted'
  | 'numbered'
  | 'todo'
  | 'quote'
  | 'callout'
  | 'code'
  | 'divider'
  | 'image'
  | 'link';

export type EditorMark = 'bold' | 'italic' | 'underline' | 'strike' | 'code';

export const EDITOR_MARKS: readonly EditorMark[] = [
  'bold',
  'italic',
  'underline',
  'strike',
  'code',
];

/** A run of text with its marks; `href` is a hyperlink, `pageId` a page link whose text the server fills. */
export interface EditorSpan {
  text: string;
  bold?: boolean | null;
  italic?: boolean | null;
  underline?: boolean | null;
  strike?: boolean | null;
  code?: boolean | null;
  href?: string | null;
  pageId?: string | null;
}

export interface EditorBlock {
  id: string;
  type: EditorBlockType;
  text?: EditorSpan[] | null;
  checked?: boolean | null;
  icon?: string | null;
  url?: string | null;
  caption?: string | null;
  imageId?: string | null;
  alt?: string | null;
}

export interface BlockTypeInfo {
  type: EditorBlockType;
  label: string;
  description: string;
  /** The markdown shortcut that makes it, shown in the slash menu. */
  shortcut?: string;
}

/** Every block type in slash-menu order, with the names screen readers hear (L2-087, L2-088). */
export const BLOCK_TYPES: readonly BlockTypeInfo[] = [
  { type: 'paragraph', label: 'Text', description: 'Plain text.' },
  { type: 'heading1', label: 'Heading 1', description: 'A big section heading.', shortcut: '#' },
  { type: 'heading2', label: 'Heading 2', description: 'A medium heading.', shortcut: '##' },
  { type: 'heading3', label: 'Heading 3', description: 'A small heading.', shortcut: '###' },
  { type: 'bulleted', label: 'Bulleted list', description: 'A simple list.', shortcut: '-' },
  { type: 'numbered', label: 'Numbered list', description: 'A list in order.', shortcut: '1.' },
  { type: 'todo', label: 'To-do', description: 'A task to tick off.', shortcut: '[]' },
  { type: 'quote', label: 'Quote', description: 'A quotation.', shortcut: '>' },
  { type: 'callout', label: 'Callout', description: 'Make a note stand out.' },
  { type: 'code', label: 'Code', description: 'Monospace text, as typed.', shortcut: '```' },
  { type: 'divider', label: 'Divider', description: 'A line between sections.', shortcut: '---' },
  { type: 'image', label: 'Image', description: 'Upload an image with alt text.' },
  { type: 'link', label: 'Link card', description: 'A link to another site.' },
];

const TEXT_TYPES = new Set<EditorBlockType>([
  'paragraph',
  'heading1',
  'heading2',
  'heading3',
  'bulleted',
  'numbered',
  'todo',
  'quote',
  'callout',
  'code',
]);

export function hasText(type: EditorBlockType): boolean {
  return TEXT_TYPES.has(type);
}

export function labelOf(type: EditorBlockType): string {
  return BLOCK_TYPES.find((t) => t.type === type)?.label ?? 'Text';
}

/** The types that continue on Enter (L2-086 AC5). */
export function continuesOnEnter(type: EditorBlockType): boolean {
  return type === 'bulleted' || type === 'numbered' || type === 'todo';
}

export function newBlockId(): string {
  return crypto.randomUUID();
}

export function newBlock(
  type: EditorBlockType = 'paragraph',
  text: EditorSpan[] = [],
): EditorBlock {
  const block: EditorBlock = { id: newBlockId(), type };
  if (hasText(type)) block.text = text;
  if (type === 'todo') block.checked = false;
  if (type === 'callout') block.icon = '💡';
  return block;
}

export function plainText(spans: readonly EditorSpan[] | null | undefined): string {
  return (spans ?? []).map((s) => s.text).join('');
}

function sameMarks(a: EditorSpan, b: EditorSpan): boolean {
  return (
    !!a.bold === !!b.bold &&
    !!a.italic === !!b.italic &&
    !!a.underline === !!b.underline &&
    !!a.strike === !!b.strike &&
    !!a.code === !!b.code &&
    (a.href ?? null) === (b.href ?? null) &&
    !a.pageId &&
    !b.pageId
  );
}

/** Drops empty runs and joins neighbours with the same marks. Page links always stay their own run. */
export function normalise(spans: readonly EditorSpan[]): EditorSpan[] {
  const out: EditorSpan[] = [];
  for (const span of spans) {
    if (!span.text && !span.pageId) continue;
    const last = out[out.length - 1];
    if (last && sameMarks(last, span))
      out[out.length - 1] = { ...last, text: last.text + span.text };
    else out.push(clean(span));
  }
  return out;
}

function clean(span: EditorSpan): EditorSpan {
  const out: EditorSpan = { text: span.text };
  for (const mark of EDITOR_MARKS) if (span[mark]) out[mark] = true;
  if (span.href) out.href = span.href;
  if (span.pageId) out.pageId = span.pageId;
  return out;
}

/** Splits the runs at a character offset; a page link is never cut in two. */
export function splitSpans(
  spans: readonly EditorSpan[],
  offset: number,
): [EditorSpan[], EditorSpan[]] {
  const before: EditorSpan[] = [];
  const after: EditorSpan[] = [];
  let at = 0;
  for (const span of spans) {
    const end = at + span.text.length;
    if (end <= offset) before.push(span);
    else if (at >= offset || span.pageId) after.push(span);
    else {
      before.push({ ...span, text: span.text.slice(0, offset - at) });
      after.push({ ...span, text: span.text.slice(offset - at) });
    }
    at = end;
  }
  return [normalise(before), normalise(after)];
}

/** The runs between two offsets, cut to fit. */
export function sliceSpans(spans: readonly EditorSpan[], start: number, end: number): EditorSpan[] {
  const [, rest] = splitSpans(spans, start);
  return splitSpans(rest, end - start)[0];
}

/** Whether every character between the offsets has the mark (L2-088 AC1). */
export function hasMark(
  spans: readonly EditorSpan[],
  start: number,
  end: number,
  mark: EditorMark,
): boolean {
  const range = sliceSpans(spans, start, end);
  return range.length > 0 && range.every((s) => !!s[mark]);
}

/** Sets or clears a mark on the characters between the offsets (L2-088 AC2). */
export function setMark(
  spans: readonly EditorSpan[],
  start: number,
  end: number,
  mark: EditorMark,
  on: boolean,
): EditorSpan[] {
  return mapRange(spans, start, end, (s) => ({ ...s, [mark]: on || null }));
}

/** Sets or clears the hyperlink on the characters between the offsets (L2-088 AC3, AC4). */
export function setHref(
  spans: readonly EditorSpan[],
  start: number,
  end: number,
  href: string | null,
): EditorSpan[] {
  return mapRange(spans, start, end, (s) => (s.pageId ? s : { ...s, href }));
}

function mapRange(
  spans: readonly EditorSpan[],
  start: number,
  end: number,
  change: (span: EditorSpan) => EditorSpan,
): EditorSpan[] {
  const [before, rest] = splitSpans(spans, start);
  const [middle, after] = splitSpans(rest, end - start);
  return normalise([...before, ...middle.map(change), ...after]);
}

/** The hyperlink under an offset, with the extent of the linked text, for "Edit link" (L2-088 AC4). */
export function linkAt(
  spans: readonly EditorSpan[],
  offset: number,
): { href: string; start: number; end: number } | null {
  let at = 0;
  for (const span of spans) {
    const end = at + span.text.length;
    if (span.href && offset >= at && offset <= end) return { href: span.href, start: at, end };
    at = end;
  }
  return null;
}

/** Inserts runs at an offset, such as a page link (L2-090 AC1). */
export function insertSpans(
  spans: readonly EditorSpan[],
  offset: number,
  inserted: readonly EditorSpan[],
): EditorSpan[] {
  const [before, after] = splitSpans(spans, offset);
  return normalise([...before, ...inserted, ...after]);
}

/** Removes the characters between the offsets, such as a typed "/run" or "[[run". */
export function removeRange(
  spans: readonly EditorSpan[],
  start: number,
  end: number,
): EditorSpan[] {
  const [before, rest] = splitSpans(spans, start);
  return normalise([...before, ...splitSpans(rest, end - start)[1]]);
}

/** The length a run takes up in the text box: a page link counts as its shown text. */
export function textLength(spans: readonly EditorSpan[]): number {
  return spans.reduce((n, s) => n + s.text.length, 0);
}

/** Markdown shortcuts typed at the start of a Text block (L2-088 AC6). */
export const MARKDOWN_SHORTCUTS: readonly { marker: string; type: EditorBlockType }[] = [
  { marker: '### ', type: 'heading3' },
  { marker: '## ', type: 'heading2' },
  { marker: '# ', type: 'heading1' },
  { marker: '- ', type: 'bulleted' },
  { marker: '* ', type: 'bulleted' },
  { marker: '1. ', type: 'numbered' },
  { marker: '[] ', type: 'todo' },
  { marker: '> ', type: 'quote' },
  { marker: '```', type: 'code' },
  { marker: '---', type: 'divider' },
];

export function shortcutFor(text: string): { marker: string; type: EditorBlockType } | null {
  return MARKDOWN_SHORTCUTS.find((s) => text.startsWith(s.marker)) ?? null;
}

/** "Heading 2 “Run sheet”", the block as a move announcement names it (L2-089 AC5). */
export function describeBlock(block: EditorBlock): string {
  const words = plainText(block.text).trim().split(/\s+/).filter(Boolean).slice(0, 4).join(' ');
  const label = labelOf(block.type);
  if (block.type === 'image' && block.alt) return `${label} “${block.alt}”`;
  return words ? `${label} “${words}”` : label;
}
