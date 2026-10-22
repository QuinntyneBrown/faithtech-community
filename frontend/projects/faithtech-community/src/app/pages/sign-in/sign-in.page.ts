import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { AUTH_SERVICE } from '@faithtech-community/api';
import {
  AuthLayoutComponent,
  CardComponent,
  LinkComponent,
  SignInCredentials,
  SignInFormComponent,
  SignInFormFailure,
  StackComponent,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

/** Sign in with email and password (L2-003), matching docs/mocks/pages/sign-in. */
@Component({
  selector: 'ft-sign-in-page',
  imports: [AuthLayoutComponent, CardComponent, StackComponent, SignInFormComponent, LinkComponent],
  templateUrl: './sign-in.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignInPage {
  private readonly auth = inject(AUTH_SERVICE);

  /** Where to go after signing in: an app url, or the identity server's /connect/authorize url. */
  readonly returnUrl = input<string>();

  protected readonly busy = signal(false);
  protected readonly failure = signal<SignInFormFailure | null>(null);

  protected async submit({ email, password, keepSignedIn }: SignInCredentials): Promise<void> {
    if (this.busy()) return;
    this.failure.set(null);
    this.busy.set(true);
    try {
      const outcome = await firstValueFrom(this.auth.signInWithPassword(email, password));
      if (!outcome.succeeded) {
        this.failure.set(outcome.error);
        return;
      }
      await this.continue(keepSignedIn);
    } catch {
      this.failure.set('unreachable');
    } finally {
      this.busy.set(false);
    }
  }

  private async continue(keepSignedIn: boolean): Promise<void> {
    const returnUrl = this.returnUrl();
    // The identity server sent us here mid-flow: resume it, the PKCE state is already stored.
    if (returnUrl?.startsWith('/connect/')) {
      window.location.assign(returnUrl);
      return;
    }
    await this.auth.signIn(isAppUrl(returnUrl) ? returnUrl : '/', keepSignedIn);
  }
}

function isAppUrl(url: string | undefined): url is string {
  return !!url && url.startsWith('/') && !url.startsWith('//');
}
