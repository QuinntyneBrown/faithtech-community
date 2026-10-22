import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewEncapsulation,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import {
  EditorBlock,
  EditorBlockType,
  EditorSpan,
  continuesOnEnter,
  hasText,
  labelOf,
  newBlock,
  normalise,
  plainText,
  splitSpans,
} from './editor-model';
import { RichTextDirective } from './rich-text.directive';
import { PageLinkResolver, caretOffset, readSpans, setSelection } from './rich-text';

export const MAX_BLOCKS = 500;

/** A run of blocks of the same list type, for the read-only view's real lists (L2-087 AC3). */
interface ViewGroup {
  kind: 'bulleted' | 'numbered' | 'single';
  blocks: EditorBlock[];
}

type Caret = 'start' | 'end' | number;

/**
 * The block page surface (design system, block editor; ADR 0024): an ordered list of blocks, each text block its
 * own contenteditable text box named by its type. It edits a copy of `blocks` and emits every change through
 * `blocksChange`; the page saves it. With `readonly` it renders the blocks as plain content (headings, real
 * lists, quotes, code) with nothing editable.
 */
@Component({
  selector: 'ft-block-editor',
  imports: [NgTemplateOutlet, RichTextDirective],
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

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector = inject(Injector);

  protected readonly items = signal<EditorBlock[]>([]);
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

  /** Typing: the runs are read back from the DOM, so nothing re-renders under the caret. */
  protected onInput(index: number, event: Event): void {
    const el = event.target as HTMLElement;
    this.change(index, { text: readSpans(el) }, false);
  }

  /** Pastes plain text only (ADR 0024). */
  protected onPaste(index: number, event: ClipboardEvent): void {
    event.preventDefault();
    const el = event.target as HTMLElement;
    const text = (event.clipboardData?.getData('text/plain') ?? '').replace(/\r\n?/g, '\n');
    this.replaceSelection(index, el, [{ text }]);
  }

  protected onKeydown(index: number, event: KeyboardEvent): void {
    const el = event.currentTarget as HTMLElement;
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
    const next = newBlock(type === 'callout' || type === 'quote' ? type : type, after);
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
    const marks = { ...(splitSpans(spans, start)[0].at(-1) ?? {}), pageId: null, text: '' };
    const text = normalise([...before, ...inserted.map((s) => ({ ...marks, ...s })), ...after]);
    this.change(index, { text }, true);
    this.focusBlock(index, start + plainText(inserted).length);
  }

  /** Turns a block into another text type, keeping its text (L2-088 AC10). */
  protected turnInto(index: number, type: EditorBlockType): void {
    const block = this.items()[index];
    const changed = newBlock(
      type,
      block.type === 'code' ? [{ text: plainText(block.text) }] : (block.text ?? []),
    );
    this.change(index, { ...changed, id: block.id }, true);
    this.focusBlock(index, 'end');
  }

  private change(index: number, patch: Partial<EditorBlock>, render: boolean): void {
    const items = [...this.items()];
    items[index] = { ...items[index], ...patch };
    if (!render) this.items.set(items);
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

  /** Focuses a block once it has rendered, with the caret at its start, end or an offset. */
  protected focusBlock(index: number, caret: Caret): void {
    afterNextRender(
      () => {
        const block = this.items()[index];
        if (!block) return;
        const el = this.host.querySelector<HTMLElement>(
          `[data-block-id="${block.id}"] [data-text]`,
        );
        const target =
          el ?? this.host.querySelector<HTMLElement>(`[data-block-id="${block.id}"] [data-focus]`);
        if (!target) return;
        target.focus();
        if (!el) return;
        const length = plainText(readSpans(el)).length;
        setSelection(
          el,
          caret === 'start' ? 0 : caret === 'end' ? length : Math.min(caret, length),
        );
      },
      { injector: this.injector },
    );
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
