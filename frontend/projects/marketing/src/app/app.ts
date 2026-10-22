import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import {
  ButtonComponent,
  SiteFooterComponent,
  SkipLinkComponent,
  TopBarComponent,
} from '@faithtech-community/components';

/**
 * The marketing page's shell (docs/detailed-designs/marketing/landing-page): skip link, the
 * anonymous top bar with Join now and Sign in, the page and the footer.
 */
@Component({
  selector: 'ft-marketing-root',
  imports: [RouterOutlet, ButtonComponent, SiteFooterComponent, SkipLinkComponent, TopBarComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarketingAppComponent {
  private readonly router = inject(Router);

  /** Switches the hero panel to the sign-up form (`?join`) or back to sign in, keeping the page. */
  protected show(form: 'join' | 'sign-in'): void {
    const join = form === 'join' ? '' : null;
    void this.router.navigate([], { queryParams: { join }, queryParamsHandling: 'merge' });
  }
}
