import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * The marketing page's footer landmark (docs/design-system/components/site-footer.html): the
 * copyright and a short list of projected links (`<li><a>` items).
 */
@Component({
  selector: 'ft-site-footer',
  templateUrl: './site-footer.component.html',
  styleUrl: './site-footer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SiteFooterComponent {
  readonly copyright = input.required<string>();
  readonly linksLabel = input('Footer');
}
