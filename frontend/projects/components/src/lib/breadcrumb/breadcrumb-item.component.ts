import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** One breadcrumb entry: a link when `href` is set, otherwise the current page as plain text. */
@Component({
  selector: 'ft-breadcrumb-item',
  imports: [NgTemplateOutlet],
  templateUrl: './breadcrumb-item.component.html',
  styleUrl: './breadcrumb-item.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'listitem',
    '[attr.aria-current]': 'href() ? null : "page"',
  },
})
export class BreadcrumbItemComponent {
  readonly href = input<string | null>(null);
}
