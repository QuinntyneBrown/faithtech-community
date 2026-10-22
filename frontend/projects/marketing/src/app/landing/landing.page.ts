import { ChangeDetectionStrategy, Component } from '@angular/core';

/** The marketing page (L2-055), matching docs/mocks/pages/marketing. */
@Component({
  selector: 'ft-landing-page',
  templateUrl: './landing.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingPage {}
