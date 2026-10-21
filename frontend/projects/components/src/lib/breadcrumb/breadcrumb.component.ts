import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Trail above the page title: ancestors as `ft-breadcrumb-item` links, then the current page. */
@Component({
  selector: 'ft-breadcrumb',
  templateUrl: './breadcrumb.component.html',
  styleUrl: './breadcrumb.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BreadcrumbComponent {
  readonly label = input('Breadcrumb');
}
