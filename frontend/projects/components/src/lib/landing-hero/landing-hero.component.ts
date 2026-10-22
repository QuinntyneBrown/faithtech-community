import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * The marketing page's split hero (docs/design-system/components/landing-hero.html): eyebrow, the
 * page's `<h1>` and a lead, with the sign-in panel (`ftHeroPanel`) beside them from 1024px and the
 * media (`ftHeroMedia`) under the copy. Smaller screens stack copy, panel, media in source order.
 */
@Component({
  selector: 'ft-landing-hero',
  templateUrl: './landing-hero.component.html',
  styleUrl: './landing-hero.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingHeroComponent {
  readonly eyebrow = input<string | null>(null);
  readonly heading = input.required<string>();
  readonly lead = input<string | null>(null);
}
