import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

export type FormatMark = 'bold' | 'italic' | 'underline' | 'strike' | 'code';

interface Tool {
  id: FormatMark | 'link' | 'remove-link';
  label: string;
  glyph: string;
  shortcut: string;
}

const MARKS: readonly Tool[] = [
  { id: 'bold', label: 'Bold', glyph: 'B', shortcut: 'Ctrl+B' },
  { id: 'italic', label: 'Italic', glyph: 'I', shortcut: 'Ctrl+I' },
  { id: 'underline', label: 'Underline', glyph: 'U', shortcut: 'Ctrl+U' },
  { id: 'strike', label: 'Strikethrough', glyph: 'S', shortcut: 'Ctrl+Shift+S' },
  { id: 'code', label: 'Inline code', glyph: '</>', shortcut: 'Ctrl+E' },
];

/**
 * The formatting toolbar over a text selection (design system, format toolbar): a toolbar named "Formatting" whose
 * buttons expose their pressed state, reached with Alt+F10 from the text and moved through with ← and → (L2-088
 * AC1-AC4, L2-099 AC4). Pressing a button keeps the selection in the text.
 */
@Component({
  selector: 'ft-format-toolbar',
  templateUrl: './format-toolbar.component.html',
  styleUrl: './format-toolbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'toolbar', 'aria-label': 'Formatting', '(keydown)': 'onKeydown($event)' },
})
export class FormatToolbarComponent {
  /** The marks the whole selection already has. */
  readonly pressed = input<Partial<Record<FormatMark, boolean>>>({});
  /** Whether text is selected (marks apply) and whether the caret is in a link (edit and remove). */
  readonly hasSelection = input(true);
  readonly inLink = input(false);
  readonly format = output<FormatMark>();
  readonly link = output<void>();
  readonly removeLink = output<void>();
  /** Escape: focus goes back to the text. */
  readonly dismissed = output<void>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  protected readonly focused = signal(0);
  protected readonly tools = computed<Tool[]>(() => [
    ...(this.hasSelection() ? MARKS : []),
    { id: 'link', label: this.inLink() ? 'Edit link' : 'Link', glyph: '🔗', shortcut: 'Ctrl+K' },
    ...(this.inLink()
      ? [{ id: 'remove-link' as const, label: 'Remove link', glyph: '⨯', shortcut: '' }]
      : []),
  ]);

  /** Alt+F10 lands on the first button. */
  focus(): void {
    this.focused.set(0);
    this.host.querySelector<HTMLButtonElement>('button')?.focus();
  }

  protected isPressed(tool: Tool): boolean | null {
    return tool.id === 'link' || tool.id === 'remove-link' ? null : !!this.pressed()[tool.id];
  }

  protected use(tool: Tool): void {
    if (tool.id === 'link') this.link.emit();
    else if (tool.id === 'remove-link') this.removeLink.emit();
    else this.format.emit(tool.id);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const buttons = Array.from(this.host.querySelectorAll<HTMLButtonElement>('button'));
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (step) {
      event.preventDefault();
      const next = (this.focused() + step + buttons.length) % buttons.length;
      this.focused.set(next);
      buttons[next]?.focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.dismissed.emit();
    }
  }
}
