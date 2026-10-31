import { ChangeDetectionStrategy, Component, ElementRef, input, viewChild } from '@angular/core';

/**
 * Page title block (the page's h1 and subtitle) with an actions slot (`ftPageHeaderActions`).
 * Without `subtitle`, rich subtitle content such as a status badge goes in `ftPageHeaderSubtitle`.
 */
@Component({
  selector: 'ft-page-header',
  templateUrl: './page-header.component.html',
  styleUrl: './page-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string | null>(null);
  /** Small uppercase line above the title, such as "{organisation} Toronto · Public event" (`.overline`). */
  readonly overline = input<string | null>(null);

  private readonly heading = viewChild.required<ElementRef<HTMLElement>>('heading');

  /** Moves focus to the h1, for when an action removed the control that had focus. */
  focusTitle(): void {
    this.heading().nativeElement.focus();
  }
}
