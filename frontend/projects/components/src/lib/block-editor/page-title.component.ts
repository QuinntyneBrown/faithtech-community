import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  input,
  output,
  viewChild,
} from '@angular/core';

/**
 * The page title of a block page (design system, block editor: title): a single-line text box labelled
 * "Page title" with the placeholder "Untitled", rendered as the page's only level-one heading. Read-only, it is
 * plain heading text. Enter moves on to the first block (`submitted`).
 */
@Component({
  selector: 'ft-page-title',
  templateUrl: './page-title.component.html',
  styleUrl: './page-title.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageTitleComponent {
  readonly value = input('');
  readonly readonly = input(false);
  readonly maxLength = input(200);
  readonly placeholder = input('Untitled');
  readonly valueChange = output<string>();
  readonly submitted = output<void>();

  private readonly box = viewChild<ElementRef<HTMLElement>>('box');

  constructor() {
    // Write the text only when it differs, so typing never moves the caret.
    effect(() => {
      const el = this.box()?.nativeElement;
      const value = this.value();
      if (el && el.textContent !== value) el.textContent = value;
    });
  }

  focus(): void {
    this.box()?.nativeElement.focus();
  }

  protected onInput(): void {
    const el = this.box()!.nativeElement;
    let text = (el.textContent ?? '').replace(/\n/g, ' ');
    if (text.length > this.maxLength()) {
      text = text.slice(0, this.maxLength());
      el.textContent = text;
      placeCaretAtEnd(el);
    }
    if (!text) el.textContent = '';
    this.valueChange.emit(text);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.submitted.emit();
    }
  }

  /** Pastes plain text only, on one line. */
  protected onPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const text = (event.clipboardData?.getData('text/plain') ?? '').replace(/\s*\n\s*/g, ' ');
    document.execCommand('insertText', false, text);
  }
}

function placeCaretAtEnd(el: HTMLElement): void {
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}
