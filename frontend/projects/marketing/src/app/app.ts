import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/** The marketing page's shell (docs/detailed-designs/marketing/landing-page). */
@Component({
  selector: 'ft-marketing-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarketingAppComponent {}
