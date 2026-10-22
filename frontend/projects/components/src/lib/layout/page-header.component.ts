import { ChangeDetectionStrategy, Component, input } from '@angular/core';

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
}
