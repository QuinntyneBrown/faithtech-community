import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  AUTH_SERVICE,
  OrganisationNames,
  signUpFieldErrors,
  SignUpFieldErrors,
} from '@faithtech-community/api';
import {
  AuthLayoutComponent,
  CardComponent,
  LinkComponent,
  SignUpDetails,
  SignUpFormComponent,
  StackComponent,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

/** Create an account (L2-001), matching docs/mocks/pages/sign-up. */
@Component({
  selector: 'ft-sign-up-page',
  imports: [AuthLayoutComponent, CardComponent, StackComponent, SignUpFormComponent, LinkComponent],
  templateUrl: './sign-up.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignUpPage {
  protected readonly organisation = inject(OrganisationNames);
  private readonly auth = inject(AUTH_SERVICE);

  protected readonly busy = signal(false);
  protected readonly unreachable = signal(false);
  protected readonly serverErrors = signal<SignUpFieldErrors>({});
  protected readonly sentTo = signal<string | null>(null);

  protected verifyEmailLink(email: string): string {
    return `/verify-email?email=${encodeURIComponent(email)}`;
  }

  protected async submit(request: SignUpDetails): Promise<void> {
    if (this.busy()) return;
    this.serverErrors.set({});
    this.unreachable.set(false);
    this.busy.set(true);
    try {
      await firstValueFrom(this.auth.signUp(request));
      this.sentTo.set(request.email);
    } catch (error) {
      const fieldErrors = signUpFieldErrors(error);
      if (fieldErrors) this.serverErrors.set(fieldErrors);
      else this.unreachable.set(true);
    } finally {
      this.busy.set(false);
    }
  }
}
