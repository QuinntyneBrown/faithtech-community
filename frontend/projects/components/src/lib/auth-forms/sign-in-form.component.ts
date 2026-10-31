import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  afterNextRender,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { AlertComponent } from '../alert/alert.component';
import { ORGANISATION_NAMES } from '../organisation-names/organisation-names';
import { ButtonComponent } from '../button/button.component';
import { FormErrorFocusDirective } from '../form-error-focus/form-error-focus.directive';
import { FormFieldComponent } from '../form-field/form-field.component';
import { StackComponent } from '../layout/stack.component';
import { LinkComponent } from '../link/link.component';
import { SwitchComponent } from '../switch/switch.component';
import { TextFieldComponent } from '../text-field/text-field.component';

/** Why the last sign-in did not go through; the page maps the API's answer onto one of these. */
export type SignInFormFailure =
  'invalid_credentials' | 'locked_out' | 'suspended' | 'unreachable' | 'google_failed';

export interface SignInCredentials {
  email: string;
  password: string;
  keepSignedIn: boolean;
}

/**
 * The sign-in form shared by the community app's /sign-in page and the marketing page
 * (docs/design-system/components/auth-forms.html). Presentation only: the page signs in and passes
 * `busy` and `failure` back. Project other ways in (the Google button) with `ftAuthAlternatives`.
 */
@Component({
  selector: 'ft-sign-in-form',
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    ButtonComponent,
    FormErrorFocusDirective,
    FormFieldComponent,
    LinkComponent,
    StackComponent,
    SwitchComponent,
    TextFieldComponent,
  ],
  templateUrl: './sign-in-form.component.html',
  styleUrl: './auth-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignInFormComponent {
  protected readonly organisation = inject(ORGANISATION_NAMES);
  readonly busy = input(false);
  readonly failure = input<SignInFormFailure | null>(null);
  readonly forgotPasswordHref = input('/forgot-password');
  /** Text of the line between `ftAuthAlternatives` and the fields ("or"); none when null. */
  readonly divider = input<string | null>(null);
  readonly submitted = output<SignInCredentials>();

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', Validators.required],
    password: ['', Validators.required],
    keepSignedIn: [false],
  });
  protected readonly attempted = signal(false);
  private readonly errorFocus = viewChild.required(FormErrorFocusDirective);

  constructor() {
    const injector = inject(Injector);
    // A failure arrives after the request: move focus to its alert once it is on screen.
    effect(() => {
      if (!this.failure()) return;
      afterNextRender(() => this.errorFocus().focusFirstError(), { injector });
    });
  }

  /** Whether "Keep me signed in on this device" is ticked, for the other ways in (Google). */
  keepSignedIn(): boolean {
    return this.form.controls.keepSignedIn.value;
  }

  protected error(field: 'email' | 'password'): string {
    if (this.failure() === 'invalid_credentials' && field === 'password') {
      return 'Email or password is wrong. Check both and try again.';
    }
    if (!this.attempted() || !this.form.controls[field].hasError('required')) return '';
    return field === 'email' ? 'Enter your email address.' : 'Enter your password.';
  }

  protected submit(): void {
    this.attempted.set(true);
    if (this.form.invalid || this.busy()) return;
    this.submitted.emit(this.form.getRawValue());
  }
}
