import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AUTH_SERVICE } from '@faithtech-community/api';
import {
  AlertComponent,
  AuthLayoutComponent,
  ButtonComponent,
  CardComponent,
  FormErrorFocusDirective,
  FormFieldComponent,
  LinkComponent,
  StackComponent,
  TextFieldComponent,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

// Loose check that matches the server's validator; the server is the authority.
const EMAIL = /^[^\s@]+@[^\s@]+$/;

/** Ask for a password reset link (L2-004 AC1), matching docs/mocks/pages/forgot-password. */
@Component({
  selector: 'ft-forgot-password-page',
  imports: [
    ReactiveFormsModule,
    AuthLayoutComponent,
    CardComponent,
    StackComponent,
    FormFieldComponent,
    TextFieldComponent,
    ButtonComponent,
    AlertComponent,
    LinkComponent,
    FormErrorFocusDirective,
  ],
  templateUrl: './forgot-password.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForgotPasswordPage {
  private readonly auth = inject(AUTH_SERVICE);
  private readonly errorFocus = viewChild.required(FormErrorFocusDirective);

  protected readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(EMAIL)],
    }),
  });
  protected readonly invalid = signal(false);
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);
  protected readonly sentTo = signal<string | null>(null);

  protected async submit(): Promise<void> {
    this.failed.set(false);
    this.invalid.set(this.form.invalid);
    if (this.form.invalid || this.busy()) return;

    const email = this.form.controls.email.value.trim();
    this.busy.set(true);
    try {
      await firstValueFrom(this.auth.requestPasswordReset(email));
      this.sentTo.set(email);
    } catch {
      this.failed.set(true);
      this.errorFocus().focusFirstError();
    } finally {
      this.busy.set(false);
    }
  }
}
