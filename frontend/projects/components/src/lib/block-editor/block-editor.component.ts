import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import { SlashMenuComponent, SlashMenuOption } from '../slash-menu/slash-menu.component';
import {
  BLOCK_TYPES,
  EditorBlock,
  EditorBlockType,
  EditorSpan,
  continuesOnEnter,
  hasText,
  labelOf,
  newBlock,
  normalise,
  plainText,
  removeRange,
  shortcutFor,
  splitSpans,
} from './editor-model';
import { PageLinkResolver, caretOffset, caretRect, readSpans, setSelection } from './rich-text';
import { RichTextDirective } from './rich-text.directive';

export const MAX_BLOCKS = 500;

/** A block the page fills through a dialog: a link card or an image (L2-087 AC9, L2-097 AC1). */
export interface BlockRequest {
  type: 'link' | 'image';
  /** The block it replaces (an empty Text block) or follows. */
  index: number;
  replace: boolean;
}

/** A run of blocks of the same list type, for the read-only view's real lists (L2-087 AC3). */
interface ViewGroup {
  kind: 'bulleted' | 'numbered' | 'single';
  blocks: EditorBlock[];
}

/** The slash menu while it is open: the block, where the "/" is, and the typed filter. */
interface Popup {
  index: number;
  start: number;
  query: string;
  active: number;
  top: number;
  left: number;
}

type Caret = 'start' | 'end' | number;

const GLYPHS: Partial<Record<EditorBlockType, string>> = {
  paragraph: 'T',
  heading1: 'H1',
  heading2: 'H2',
  heading3: 'H3',
  bulleted: '•',
  numbered: '1.',
  todo: '☑',
  quote: '❝',
  callout: '💡',
  code: '</>',
  divider: '—',
  image: '🖼',
  link: '🔗',
};

let nextId = 0;

/**
 * The block page surface (design system, block editor; ADR 0024): an ordered list of blocks, each text block its
 * own contenteditable text box named by its type. It edits a copy of `blocks` and emits every change through
 * `blocksChange`; the page saves it. Markdown shortcuts and the slash menu insert or turn blocks into other types;
 * a link card or image is requested from the page (`blockRequested`), which fills it through a dialog and hands it
 * back with {@link place}. With `readonly` it renders the blocks as plain content with nothing editable.
 */
@Component({
  selector: 'ft-block-editor',
  imports: [NgTemplateOutlet, RichTextDirective, SlashMenuComponent],
  templateUrl: './block-editor.component.html',
  styleUrl: './block-editor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class BlockEditorComponent {
  readonly blocks = input<readonly EditorBlock[]>([]);
  readonly readonly = input(false);
  /** How page links show to this viewer; the page resolves them from the API's text. */
  readonly pageLink = input<PageLinkResolver | undefined>(undefined);
  readonly blocksChange = output<EditorBlock[]>();
  /** The editor refused a change, such as a 501st block (L2-086 AC11). */
  readonly refused = output<string>();
  readonly blockRequested = output<BlockRequest>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly cdr = inject(ChangeDetectorRef);

  protected readonly items = signal<EditorBlock[]>([]);
  protected readonly popup = signal<Popup | null>(null);
  protected readonly menuId = `ft-slash-menu-${nextId++}`;
  protected readonly labelOf = labelOf;
  protected readonly hasText = hasText;
  protected readonly groups = computed(() => groupBlocks(this.items()));
  /** The number each Numbered list block shows; it restarts after any other block (L2-087 AC3). */
  protected readonly numbers = computed(() => {
    const numbers = new Map<string, number>();
    let n = 0;
    for (const block of this.items()) {
      n = block.type === 'numbered' ? n + 1 : 0;
      if (n) numbers.set(block.id, n);
    }
    return numbers;
  });
  /** The slash menu's options, filtered by what was typed after the "/" (L2-088 AC7). */
  protected readonly options = computed<SlashMenuOption[]>(() => {
    const query = this.popup()?.query.trim().toLowerCase() ?? '';
    return BLOCK_TYPES.filter((t) => t.label.toLowerCase().includes(query)).map((t) => ({
      id: t.type,
      label: t.label,
      description: t.description,
      glyph: GLYPHS[t.type],
      shortcut: t.shortcut,
    }));
  });

  constructor() {
    // An empty page starts with one empty Text block (L2-086 AC4).
    effect(() => {
      const blocks = this.blocks();
      const editable = !this.readonly();
      this.items.set(blocks.length === 0 && editable ? [newBlock()] : [...blocks]);
    });
  }

  /** Focuses the first block, at its start; the title's Enter lands here. */
  focusFirst(): void {
    this.focusBlock(0, 'start');
  }

  /** Puts a block the page filled in through a dialog where it was asked for, and focuses after it. */
  place(request: BlockRequest, block: EditorBlock): void {
    const items = [...this.items()];
    if (request.replace) items[request.index] = block;
    else items.splice(request.index + 1, 0, block);
    const at = request.replace ? request.index : request.index + 1;
    if (at === items.length - 1) items.push(newBlock());
    this.commit(items);
    this.focusBlock(at + 1, 'start');
  }

  protected placeholderOf(block: EditorBlock, index: number): string | null {
    if (block.type !== 'paragraph') return null;
    return index === 0 && this.items().length === 1
      ? 'Type / for blocks, or [[ to link a page'
      : null;
  }

  protected numberOf(block: EditorBlock): number | null {
    return this.numbers().get(block.id) ?? null;
  }

  protected plain(block: EditorBlock): string {
    return plainText(block.text);
  }

  protected hostOf(url: string | null | undefined): string {
    try {
      return new URL(url ?? '').host.replace(/^www\./, '');
    } catch {
      return url ?? '';
    }
  }

  protected activeOption(index: number): string | null {
    const popup = this.popup();
    return popup?.index === index && this.options().length > 0
      ? `${this.menuId}-${popup.active}`
      : null;
  }

  protected toggle(index: number, checked: boolean): void {
    this.change(index, { checked });
  }

  /** Typing: the runs are read back from the DOM, so nothing re-renders under the caret. */
  protected onInput(index: number, event: Event): void {
    const el = event.target as HTMLElement;
    const spans = readSpans(el);
    const caret = caretOffset(el) ?? plainText(spans).length;
    const block = this.items()[index];
    const shortcut = block.type === 'paragraph' ? shortcutFor(plainText(spans)) : null;
    if (shortcut && caret === shortcut.marker.length) {
      this.applyShortcut(index, spans, shortcut.marker.length, shortcut.type);
      return;
    }
    this.change(index, { text: spans });
    this.trackSlash(index, el, spans, caret);
  }

  /** Pastes plain text only (ADR 0024). */
  protected onPaste(index: number, event: ClipboardEvent): void {
    event.preventDefault();
    const el = event.target as HTMLElement;
    const text = (event.clipboardData?.getData('text/plain') ?? '').replace(/\r\n?/g, '\n');
    this.replaceSelection(index, el, [{ text }]);
  }

  protected onBlur(index: number): void {
    if (this.popup()?.index === index) this.popup.set(null);
  }

  protected onKeydown(index: number, event: KeyboardEvent): void {
    const el = event.currentTarget as HTMLElement;
    if (this.popup()?.index === index && this.menuKey(event)) return;
    const block = this.items()[index];
    switch (event.key) {
      case 'Enter':
        event.preventDefault();
        if (event.shiftKey || block.type === 'code')
          this.replaceSelection(index, el, [{ text: '\n' }]);
        else this.enter(index, el);
        return;
      case 'Backspace':
        if (caretOffset(el) === 0 && caretOffset(el, 'end') === 0) {
          event.preventDefault();
          this.backspace(index);
        }
        return;
      case 'ArrowUp':
      case 'ArrowLeft':
        if (index > 0 && caretOffset(el) === 0 && caretOffset(el, 'end') === 0) {
          event.preventDefault();
          this.focusBlock(index - 1, 'end');
        }
        return;
      case 'ArrowDown':
      case 'ArrowRight': {
        const length = plainText(readSpans(el)).length;
        if (index < this.items().length - 1 && caretOffset(el) === length) {
          event.preventDefault();
          this.focusBlock(index + 1, 'start');
        }
        return;
      }
    }
  }

  /** Chooses a slash-menu option by click. */
  protected choose(type: string): void {
    const popup = this.popup();
    if (popup) this.insertFromSlash(popup, type as EditorBlockType);
  }

  /** ↑, ↓, Enter, Escape and Tab while the slash menu is open (L2-088 AC7). Returns whether it handled the key. */
  private menuKey(event: KeyboardEvent): boolean {
    const popup = this.popup()!;
    const count = this.options().length;
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        event.preventDefault();
        if (count > 0) {
          const step = event.key === 'ArrowDown' ? 1 : -1;
          this.popup.set({ ...popup, active: (popup.active + step + count) % count });
        }
        return true;
      case 'Enter':
        event.preventDefault();
        if (count > 0)
          this.insertFromSlash(popup, this.options()[popup.active].id as EditorBlockType);
        return true;
      case 'Escape':
        event.preventDefault();
        this.popup.set(null);
        return true;
      case 'Tab':
        this.popup.set(null);
        return false;
    }
    return false;
  }

  /** Opens, filters or closes the slash menu as the text around the caret changes. */
  private trackSlash(index: number, el: HTMLElement, spans: EditorSpan[], caret: number): void {
    const text = plainText(spans);
    const popup = this.popup();
    if (popup?.index === index) {
      const query = text.slice(popup.start + 1, caret);
      if (caret <= popup.start || text[popup.start] !== '/' || /\s/.test(query))
        this.popup.set(null);
      else this.popup.set({ ...popup, query, active: 0 });
      return;
    }
    const block = this.items()[index];
    const opens =
      text[caret - 1] === '/' &&
      (caret === 1 || /\s/.test(text[caret - 2])) &&
      block.type !== 'code';
    if (!opens) return;
    const rect = caretRect(el);
    const box = this.host.getBoundingClientRect();
    this.popup.set({
      index,
      start: caret - 1,
      query: '',
      active: 0,
      top: rect.bottom - box.top + 4,
      left: Math.max(0, Math.min(rect.left - box.left, box.width - 352)),
    });
  }

  /** Turns the block into the chosen type when only the command was typed, or inserts one below (L2-088 AC8). */
  private insertFromSlash(popup: Popup, type: EditorBlockType): void {
    this.popup.set(null);
    const block = this.items()[popup.index];
    const caret = popup.start + 1 + popup.query.length;
    const rest = removeRange(block.text ?? [], popup.start, caret);
    const empty = !plainText(rest) && !rest.some((s) => s.pageId);
    this.change(popup.index, { text: rest });
    if (type === 'link' || type === 'image') {
      this.blockRequested.emit({ type, index: popup.index, replace: empty });
      return;
    }
    if (empty) {
      this.turnInto(popup.index, type);
      return;
    }
    if (!this.roomFor(1)) return;
    const items = [...this.items()];
    items.splice(popup.index + 1, 0, newBlock(type));
    this.commit(items);
    this.focusBlock(popup.index + 1, 'start');
  }

  private applyShortcut(
    index: number,
    spans: EditorSpan[],
    length: number,
    type: EditorBlockType,
  ): void {
    const rest = removeRange(spans, 0, length);
    this.change(index, { text: rest });
    this.turnInto(index, type, 'start');
  }

  /** Enter splits the block at the caret; an empty list item becomes Text (L2-086 AC5, AC6). */
  private enter(index: number, el: HTMLElement): void {
    const block = this.items()[index];
    const spans = readSpans(el);
    if (!plainText(spans) && continuesOnEnter(block.type)) {
      this.turnInto(index, 'paragraph');
      return;
    }
    if (!this.roomFor(1)) return;
    const offset = caretOffset(el) ?? plainText(spans).length;
    const [before, after] = splitSpans(spans, offset);
    const type: EditorBlockType =
      after.length > 0 || continuesOnEnter(block.type) ? block.type : 'paragraph';
    const next = newBlock(type, after);
    if (type === 'callout') next.icon = block.icon;
    const items = [...this.items()];
    items[index] = { ...block, text: before };
    items.splice(index + 1, 0, next);
    this.commit(items);
    this.focusBlock(index + 1, 'start');
  }

  /** Backspace at the start: an empty block goes, a full one joins the block before (L2-086 AC7). */
  private backspace(index: number): void {
    const items = [...this.items()];
    const block = items[index];
    if (!plainText(block.text) && block.type !== 'paragraph' && hasText(block.type)) {
      this.turnInto(index, 'paragraph');
      return;
    }
    if (items.length === 1) return;
    if (!plainText(block.text) && !(block.text ?? []).some((s) => s.pageId)) {
      items.splice(index, 1);
      this.commit(items);
      if (index > 0) this.focusBlock(index - 1, 'end');
      else this.focusBlock(0, 'start');
      return;
    }
    const previous = items[index - 1];
    if (!previous || !hasText(previous.type)) return;
    const at = plainText(previous.text).length;
    items[index - 1] = {
      ...previous,
      text: normalise([...(previous.text ?? []), ...(block.text ?? [])]),
    };
    items.splice(index, 1);
    this.commit(items);
    this.focusBlock(index - 1, at);
  }

  private replaceSelection(index: number, el: HTMLElement, inserted: EditorSpan[]): void {
    const spans = readSpans(el);
    const start = caretOffset(el) ?? plainText(spans).length;
    const end = caretOffset(el, 'end') ?? start;
    const [before] = splitSpans(spans, start);
    const [, after] = splitSpans(spans, end);
    const marks = { ...(before.at(-1) ?? {}), pageId: null, text: '' };
    const text = normalise([...before, ...inserted.map((s) => ({ ...marks, ...s })), ...after]);
    this.change(index, { text });
    this.focusBlock(index, start + plainText(inserted).length);
  }

  /** Turns a block into another type, keeping its text (L2-088 AC10); a Divider is followed by a new Text block. */
  protected turnInto(index: number, type: EditorBlockType, caret: Caret = 'end'): void {
    const block = this.items()[index];
    if (type === 'divider') {
      const items = [...this.items()];
      items[index] = { id: block.id, type: 'divider' };
      items.splice(index + 1, 0, newBlock());
      this.commit(items);
      this.focusBlock(index + 1, 'start');
      return;
    }
    const text = block.type === 'code' ? [{ text: plainText(block.text) }] : (block.text ?? []);
    this.change(index, { ...newBlock(type, text), id: block.id });
    this.focusBlock(index, caret);
  }

  private change(index: number, patch: Partial<EditorBlock>): void {
    const items = [...this.items()];
    items[index] = { ...items[index], ...patch };
    this.commit(items);
  }

  private commit(items: EditorBlock[]): void {
    this.items.set(items);
    this.blocksChange.emit(items);
  }

  private roomFor(count: number): boolean {
    if (this.items().length + count <= MAX_BLOCKS) return true;
    this.refused.emit('A page holds up to 500 blocks. Start a new page inside this one.');
    return false;
  }

  /**
   * Focuses a block with the caret at its start, end or an offset. The view is rendered first, synchronously, so
   * keys typed straight after Enter land in the new block, not the old one.
   */
  protected focusBlock(index: number, caret: Caret): void {
    this.cdr.detectChanges();
    const block = this.items()[index];
    if (!block) return;
    const row = this.host.querySelector<HTMLElement>(`[data-block-id="${block.id}"]`);
    const el = row?.querySelector<HTMLElement>('[data-text]');
    const target = el ?? row?.querySelector<HTMLElement>('[data-focus]');
    if (!target) return;
    target.focus();
    if (!el) return;
    const length = plainText(readSpans(el)).length;
    setSelection(el, caret === 'start' ? 0 : caret === 'end' ? length : Math.min(caret, length));
  }
}

function groupBlocks(blocks: readonly EditorBlock[]): ViewGroup[] {
  const groups: ViewGroup[] = [];
  for (const block of blocks) {
    const last = groups[groups.length - 1];
    if ((block.type === 'bulleted' || block.type === 'numbered') && last?.kind === block.type) {
      last.blocks.push(block);
    } else {
      groups.push({
        kind: block.type === 'bulleted' || block.type === 'numbered' ? block.type : 'single',
        blocks: [block],
      });
    }
  }
  return groups;
}
