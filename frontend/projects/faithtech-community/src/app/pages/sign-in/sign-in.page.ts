import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AUTH_SERVICE, SignInError } from '@faithtech-community/api';
import {
  AlertComponent,
  AuthLayoutComponent,
  ButtonComponent,
  CardComponent,
  FormErrorFocusDirective,
  FormFieldComponent,
  LinkComponent,
  StackComponent,
  SwitchComponent,
  TextFieldComponent,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

type Failure = SignInError | 'unreachable';

/** Sign in with email and password (L2-003), matching docs/mocks/pages/sign-in. */
@Component({
  selector: 'ft-sign-in-page',
  imports: [
    ReactiveFormsModule,
    AuthLayoutComponent,
    CardComponent,
    StackComponent,
    FormFieldComponent,
    TextFieldComponent,
    SwitchComponent,
    ButtonComponent,
    AlertComponent,
    LinkComponent,
    FormErrorFocusDirective,
  ],
  templateUrl: './sign-in.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignInPage {
  private readonly auth = inject(AUTH_SERVICE);

  /** Where to go after signing in: an app url, or the identity server's /connect/authorize url. */
  readonly returnUrl = input<string>();

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', Validators.required],
    password: ['', Validators.required],
    keepSignedIn: [false],
  });
  protected readonly submitted = signal(false);
  protected readonly busy = signal(false);
  protected readonly failure = signal<Failure | null>(null);
  private readonly errorFocus = viewChild.required(FormErrorFocusDirective);

  protected error(field: 'email' | 'password'): string {
    if (this.failure() === 'invalid_credentials' && field === 'password') {
      return 'Email or password is wrong. Check both and try again.';
    }
    if (!this.submitted() || !this.form.controls[field].hasError('required')) return '';
    return field === 'email' ? 'Enter your email address.' : 'Enter your password.';
  }

  protected async submit(): Promise<void> {
    this.submitted.set(true);
    this.failure.set(null);
    if (this.form.invalid || this.busy()) return;

    const { email, password, keepSignedIn } = this.form.getRawValue();
    this.busy.set(true);
    try {
      const outcome = await firstValueFrom(this.auth.signInWithPassword(email, password));
      if (!outcome.succeeded) {
        this.fail(outcome.error);
        return;
      }
      await this.continue(keepSignedIn);
    } catch {
      this.fail('unreachable');
    } finally {
      this.busy.set(false);
    }
  }

  private fail(failure: Failure): void {
    this.failure.set(failure);
    this.errorFocus().focusFirstError();
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
