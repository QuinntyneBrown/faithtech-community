import { Directive, ElementRef, effect, inject, input } from '@angular/core';

import { EditorSpan } from './editor-model';
import { PageLinkResolver, readSpans, renderSpans } from './rich-text';

/**
 * Keeps an element's DOM in step with a block's runs. It renders only when the runs differ from what the element
 * already shows, so typing, which updates the runs from the DOM, never re-renders and never moves the caret.
 */
@Directive({ selector: '[ftRichText]' })
export class RichTextDirective {
  readonly ftRichText = input<readonly EditorSpan[] | null | undefined>([]);
  readonly editable = input(true);
  readonly pageLink = input<PageLinkResolver | undefined>(undefined);

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  constructor() {
    effect(() => {
      const spans = this.ftRichText() ?? [];
      const editable = this.editable();
      const pageLink = this.pageLink();
      if (!editable || JSON.stringify(readSpans(this.el)) !== JSON.stringify(strip(spans))) {
        renderSpans(this.el, spans, { editable, pageLink });
      }
    });
  }

  /** Re-renders from the runs even when they look the same, after the page links resolve differently. */
  render(spans: readonly EditorSpan[]): void {
    renderSpans(this.el, spans, { editable: this.editable(), pageLink: this.pageLink() });
  }
}

/** The runs as {@link readSpans} would read them back, for comparison. */
function strip(spans: readonly EditorSpan[]): EditorSpan[] {
  const el = document.createElement('div');
  renderSpans(el, spans, { editable: true });
  return readSpans(el);
}
