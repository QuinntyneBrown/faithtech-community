import {
  CdkDrag,
  CdkDragDrop,
  CdkDragHandle,
  CdkDragPlaceholder,
  CdkDropList,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import { CdkMenu, CdkMenuTrigger } from '@angular/cdk/menu';
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
  viewChild,
} from '@angular/core';

import { FormatMark, FormatToolbarComponent } from '../format-toolbar/format-toolbar.component';
import { MenuItemComponent } from '../menu/menu-item.component';
import { PageLinkItem } from '../page-links/page-links.component';
import { SlashMenuComponent, SlashMenuOption } from '../slash-menu/slash-menu.component';
import {
  BLOCK_TYPES,
  EditorBlock,
  EditorBlockType,
  EditorSpan,
  continuesOnEnter,
  describeBlock,
  newBlockId,
  hasText,
  labelOf,
  newBlock,
  normalise,
  plainText,
  hasMark,
  insertSpans,
  linkAt,
  removeRange,
  setHref,
  setMark,
  shortcutFor,
  splitSpans,
} from './editor-model';
import {
  PageLinkResolver,
  caretOffset,
  caretRect,
  readSpans,
  selectionOffsets,
  setSelection,
} from './rich-text';
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
  /** "/" opens the slash menu, "[[" the page-link suggestions. */
  kind: 'slash' | 'pages';
  index: number;
  start: number;
  query: string;
  active: number;
  top: number;
  left: number;
}

type Caret = 'start' | 'end' | number;

/** A hyperlink the page fills in through its dialog (L2-088 AC3, AC4): the text it covers and its current href. */
export interface LinkRequest {
  index: number;
  start: number;
  end: number;
  href: string | null;
}

/** The selection the formatting toolbar acts on. */
interface Selected {
  index: number;
  start: number;
  end: number;
  link: { href: string; start: number; end: number } | null;
  top: number;
  left: number;
}

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
  imports: [
    CdkDrag,
    CdkDragHandle,
    CdkDragPlaceholder,
    CdkDropList,
    CdkMenu,
    CdkMenuTrigger,
    FormatToolbarComponent,
    MenuItemComponent,
    NgTemplateOutlet,
    RichTextDirective,
    SlashMenuComponent,
  ],
  host: { '(document:selectionchange)': 'trackSelection()' },
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
  /** Loads an image block's picture as a URL the page may show (L2-097 AC5); the page fetches it with its token. */
  readonly imageSrc = input<((imageId: string) => Promise<string>) | undefined>(undefined);
  /** Finds pages to link by title for "[[" (L2-090 AC1); without it "[[" is plain text. */
  readonly pageSearch = input<((q: string) => Promise<PageLinkItem[]>) | undefined>(undefined);
  readonly blocksChange = output<EditorBlock[]>();
  /** The editor refused a change, such as a 501st block (L2-086 AC11). */
  readonly refused = output<string>();
  readonly blockRequested = output<BlockRequest>();
  readonly linkRequested = output<LinkRequest>();
  /** The block menu's Change icon (callout) or Edit alt text (image) (L2-087 AC6, L2-097 AC8). */
  readonly blockEditRequested = output<{ index: number; block: EditorBlock }>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly cdr = inject(ChangeDetectorRef);

  protected readonly items = signal<EditorBlock[]>([]);
  protected readonly popup = signal<Popup | null>(null);
  protected readonly selected = signal<Selected | null>(null);
  /** The latest move, read out by the polite live region (L2-089 AC5). */
  protected readonly announcement = signal('');
  /** The text types a block can turn into (L2-088 AC10). */
  protected readonly textTypes = BLOCK_TYPES.filter((t) => hasText(t.type));
  private readonly toolbar = viewChild(FormatToolbarComponent);
  /** The marks the whole selection has, for the toolbar's pressed states (L2-088 AC1). */
  protected readonly pressed = computed(() => {
    const sel = this.selected();
    const spans = sel ? (this.items()[sel.index]?.text ?? []) : [];
    const marks: Partial<Record<FormatMark, boolean>> = {};
    if (sel && sel.end > sel.start)
      for (const mark of ['bold', 'italic', 'underline', 'strike', 'code'] as const)
        marks[mark] = hasMark(spans, sel.start, sel.end, mark);
    return marks;
  });
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
  /** The latest "[[" suggestions for what was typed (L2-090 AC1). */
  private readonly pageResults = signal<PageLinkItem[]>([]);
  private searchRun = 0;
  protected readonly options = computed<SlashMenuOption[]>(() => {
    const popup = this.popup();
    if (popup?.kind === 'pages') {
      return this.pageResults().map((p) => ({ id: p.id!, label: p.title, glyph: p.icon ?? '📄' }));
    }
    const query = popup?.query.trim().toLowerCase() ?? '';
    return BLOCK_TYPES.filter((t) => t.label.toLowerCase().includes(query)).map((t) => ({
      id: t.type,
      label: t.label,
      description: t.description,
      glyph: GLYPHS[t.type],
      shortcut: t.shortcut,
    }));
  });

  /** Loaded image URLs by image id. */
  private readonly images = signal<ReadonlyMap<string, string>>(new Map());
  private readonly requested = new Set<string>();

  protected imageUrl(block: EditorBlock): string | null {
    return block.imageId ? (this.images().get(block.imageId) ?? null) : null;
  }

  constructor() {
    // Each image block's picture is loaded once, through the page (L2-097 AC5).
    effect(() => {
      const load = this.imageSrc();
      for (const block of this.items()) {
        const id = block.type === 'image' ? block.imageId : null;
        if (!load || !id || this.requested.has(id)) continue;
        this.requested.add(id);
        void load(id).then(
          (url) => this.images.update((images) => new Map(images).set(id, url)),
          () => this.requested.delete(id),
        );
      }
    });
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

  /** Replaces a block in place, such as a callout with its new icon. */
  update(index: number, block: EditorBlock): void {
    this.change(index, block);
    this.focusBlock(index, 'end');
  }

  protected handleLabel(index: number, block: EditorBlock): string {
    return `Move or open the menu for block ${index + 1} of ${this.items().length}, ${labelOf(block.type)}`;
  }

  /** Moves a block one place up or down, keeps it focused and announces where it went (L2-089 AC4, AC5). */
  protected move(index: number, step: -1 | 1, caret: Caret | null = null): void {
    const to = index + step;
    if (to < 0 || to >= this.items().length) return;
    const items = [...this.items()];
    moveItemInArray(items, index, to);
    this.commit(items);
    this.announce(items[to], to);
    if (caret !== null) this.focusBlock(to, caret);
  }

  protected dropped(event: CdkDragDrop<EditorBlock[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    const items = [...this.items()];
    moveItemInArray(items, event.previousIndex, event.currentIndex);
    this.commit(items);
    this.announce(items[event.currentIndex], event.currentIndex);
  }

  protected duplicate(index: number): void {
    if (!this.roomFor(1)) return;
    const items = [...this.items()];
    items.splice(index + 1, 0, { ...structuredClone(items[index]), id: newBlockId() });
    this.commit(items);
    this.focusBlock(index + 1, 'end');
  }

  protected remove(index: number): void {
    const items = [...this.items()];
    items.splice(index, 1);
    if (items.length === 0) items.push(newBlock());
    this.commit(items);
    this.focusBlock(Math.max(0, index - 1), index > 0 ? 'end' : 'start');
  }

  protected editBlock(index: number): void {
    this.blockEditRequested.emit({ index, block: this.items()[index] });
  }

  /** Alt+Shift+↑/↓ on a handle (blocks without text are focused there). */
  protected onHandleKeydown(index: number, event: KeyboardEvent): void {
    if (event.altKey && event.shiftKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault();
      this.move(index, event.key === 'ArrowUp' ? -1 : 1, 'start');
    }
  }

  private announce(block: EditorBlock, index: number): void {
    this.announcement.set(
      `Moved ${describeBlock(block)} to position ${index + 1} of ${this.items().length}`,
    );
  }

  /** Puts a block the page filled in through a dialog where it was asked for, and focuses after it. */
  /** Links (or unlinks, with null) the text a {@link LinkRequest} covered, and selects it again. */
  applyLink(request: LinkRequest, href: string | null): void {
    const block = this.items()[request.index];
    if (!block) return;
    this.change(request.index, {
      text: setHref(block.text ?? [], request.start, request.end, href),
    });
    this.restoreSelection(request.index, request.start, request.end);
  }

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

  /** Follows the selection so the toolbar shows over selected text or a link (L2-088 AC1, AC4). */
  protected trackSelection(): void {
    if (this.readonly()) return;
    if (this.host.querySelector('ft-format-toolbar')?.contains(document.activeElement)) return;
    const selection = document.getSelection();
    const anchor = selection?.anchorNode;
    const el = (
      anchor instanceof HTMLElement ? anchor : anchor?.parentElement
    )?.closest<HTMLElement>('[data-text]');
    if (!el || !this.host.contains(el)) {
      this.selected.set(null);
      return;
    }
    const id = el.closest<HTMLElement>('[data-block-id]')?.dataset['blockId'];
    const index = this.items().findIndex((b) => b.id === id);
    const offsets = selectionOffsets(el);
    const block = this.items()[index];
    if (index < 0 || !offsets || block.type === 'code') {
      this.selected.set(null);
      return;
    }
    const start = Math.min(offsets.start, offsets.end);
    const end = Math.max(offsets.start, offsets.end);
    const link = linkAt(readSpans(el), start);
    if (start === end && !link) {
      this.selected.set(null);
      return;
    }
    const rect = caretRect(el);
    const box = this.host.getBoundingClientRect();
    this.selected.set({
      index,
      start,
      end,
      link,
      top: Math.max(0, rect.top - box.top - 52),
      left: Math.max(0, Math.min(rect.left - box.left, box.width - 320)),
    });
  }

  /** Sets or clears a mark on the selection (L2-088 AC2). */
  protected format(mark: FormatMark): void {
    const sel = this.selected();
    if (!sel || sel.end <= sel.start) return;
    const spans = this.items()[sel.index].text ?? [];
    const on = !hasMark(spans, sel.start, sel.end, mark);
    this.change(sel.index, { text: setMark(spans, sel.start, sel.end, mark, on) });
    this.restoreSelection(sel.index, sel.start, sel.end);
  }

  /** Asks the page for a link over the selection, or the link under the caret (L2-088 AC3, AC4). */
  protected requestLink(): void {
    const sel = this.selected();
    if (!sel) return;
    const range = sel.end > sel.start ? sel : (sel.link ?? sel);
    this.linkRequested.emit({
      index: sel.index,
      start: range.start,
      end: range.end,
      href: linkAt(this.items()[sel.index].text ?? [], range.start)?.href ?? null,
    });
  }

  protected removeLink(): void {
    const sel = this.selected();
    if (!sel?.link) return;
    this.applyLink({ index: sel.index, ...sel.link }, null);
  }

  protected backToText(): void {
    const sel = this.selected();
    if (sel) this.restoreSelection(sel.index, sel.start, sel.end);
  }

  private restoreSelection(index: number, start: number, end: number): void {
    this.cdr.detectChanges();
    const el = this.textBox(index);
    if (!el) return;
    el.focus();
    setSelection(el, start, end);
    this.trackSelection();
  }

  private textBox(index: number): HTMLElement | null {
    const block = this.items()[index];
    return block
      ? this.host.querySelector<HTMLElement>(`[data-block-id="${block.id}"] [data-text]`)
      : null;
  }

  /** Ctrl (Cmd on macOS) shortcuts for marks and links, and Alt+F10 to the toolbar. Returns whether it handled one. */
  private shortcut(index: number, event: KeyboardEvent): boolean {
    if (event.altKey && event.key === 'F10') {
      event.preventDefault();
      this.toolbar()?.focus();
      return true;
    }
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return false;
    const key = event.key.toLowerCase();
    const mark: FormatMark | null =
      key === 'b'
        ? 'bold'
        : key === 'i'
          ? 'italic'
          : key === 'u'
            ? 'underline'
            : key === 'e'
              ? 'code'
              : key === 's' && event.shiftKey
                ? 'strike'
                : null;
    if (mark) {
      event.preventDefault();
      if (this.items()[index].type !== 'code') {
        this.trackSelection();
        this.format(mark);
      }
      return true;
    }
    if (key === 'k') {
      event.preventDefault();
      this.trackSelection();
      this.requestLink();
      return true;
    }
    return false;
  }

  protected onBlur(index: number): void {
    if (this.popup()?.index === index) this.popup.set(null);
  }

  protected onKeydown(index: number, event: KeyboardEvent): void {
    const el = event.currentTarget as HTMLElement;
    if (this.popup()?.index === index && this.menuKey(event)) return;
    if (this.shortcut(index, event)) return;
    if (event.altKey && event.shiftKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault();
      const el = event.currentTarget as HTMLElement;
      this.move(index, event.key === 'ArrowUp' ? -1 : 1, caretOffset(el) ?? 'end');
      return;
    }
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
  protected choose(id: string): void {
    const popup = this.popup();
    if (popup?.kind === 'pages') this.insertPageLink(popup, id);
    else if (popup) this.insertFromSlash(popup, id as EditorBlockType);
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
        if (count > 0) this.choose(this.options()[popup.active].id);
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
      const marker = popup.kind === 'slash' ? '/' : '[[';
      const query = text.slice(popup.start + marker.length, caret);
      const broken =
        caret < popup.start + marker.length ||
        text.slice(popup.start, popup.start + marker.length) !== marker ||
        (popup.kind === 'slash' ? /\s/.test(query) : /[\]\n]/.test(query));
      if (broken) this.popup.set(null);
      else {
        this.popup.set({ ...popup, query, active: 0 });
        if (popup.kind === 'pages') this.searchPages(query);
      }
      return;
    }
    const block = this.items()[index];
    if (block.type === 'code') return;
    const slash = text[caret - 1] === '/' && (caret === 1 || /\s/.test(text[caret - 2]));
    const pages = !!this.pageSearch() && text.slice(caret - 2, caret) === '[[';
    if (!slash && !pages) return;
    const rect = caretRect(el);
    const box = this.host.getBoundingClientRect();
    this.popup.set({
      kind: slash ? 'slash' : 'pages',
      index,
      start: caret - (slash ? 1 : 2),
      query: '',
      active: 0,
      top: rect.bottom - box.top + 4,
      left: Math.max(0, Math.min(rect.left - box.left, box.width - 352)),
    });
    if (pages) {
      this.pageResults.set([]);
      this.searchPages('');
    }
  }

  /** Keeps the previous suggestions until the new ones arrive, so Enter always has something to choose. */
  private searchPages(query: string): void {
    const run = ++this.searchRun;
    void this.pageSearch()?.(query.trim()).then((found) => {
      if (run === this.searchRun) this.pageResults.set(found.filter((p) => p.id));
    });
  }

  /** Replaces the typed "[[term" with a link to the chosen page (L2-090 AC1). */
  private insertPageLink(popup: Popup, id: string): void {
    this.popup.set(null);
    const page = this.pageResults().find((p) => p.id === id);
    const block = this.items()[popup.index];
    if (!page || !block) return;
    const caret = popup.start + 2 + popup.query.length;
    const rest = removeRange(block.text ?? [], popup.start, caret);
    this.change(popup.index, {
      text: insertSpans(rest, popup.start, [{ text: page.title, pageId: id }]),
    });
    this.focusBlock(popup.index, popup.start + page.title.length);
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
