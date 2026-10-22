import { ChangeDetectionStrategy, Component, OnInit, inject, input } from '@angular/core';
import { AUTH_SERVICE } from '@faithtech-community/api';
import { AuthLayoutComponent } from '@faithtech-community/components';

/**
 * Starts the authorization code + PKCE flow for a session the marketing page or Google sign-in
 * has just created (ADR 0017), so the verifier and tokens live in this app's storage.
 */
@Component({
  selector: 'ft-auth-continue-page',
  imports: [AuthLayoutComponent],
  templateUrl: './auth-continue.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthContinuePage implements OnInit {
  private readonly auth = inject(AUTH_SERVICE);

  /** The app page to land on; anything that is not an app path becomes home. */
  readonly returnUrl = input<string>();
  /** "1" when the visitor ticked Keep me signed in on this device. */
  readonly keepSignedIn = input<string>();

  ngOnInit(): void {
    const returnUrl = this.returnUrl();
    const appUrl = returnUrl?.startsWith('/') && !returnUrl.startsWith('//') ? returnUrl : '/';
    void this.auth.signIn(appUrl, this.keepSignedIn() === '1');
  }
}
