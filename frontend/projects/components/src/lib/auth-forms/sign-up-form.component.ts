import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';

import { AlertComponent } from '../alert/alert.component';
import { ButtonComponent } from '../button/button.component';
import { FormErrorFocusDirective } from '../form-error-focus/form-error-focus.directive';
import { FormFieldComponent } from '../form-field/form-field.component';
import { StackComponent } from '../layout/stack.component';
import { TextFieldComponent } from '../text-field/text-field.component';

export type SignUpField = 'name' | 'email' | 'password';
export type SignUpFormErrors = Partial<Record<SignUpField, string>>;

export interface SignUpDetails {
  name: string;
  email: string;
  password: string;
}

const FIELDS: SignUpField[] = ['name', 'email', 'password'];
const MIN_PASSWORD = 12;
// The profile editor's limit, so a new member can always save their name unchanged.
const MAX_NAME = 100;
// Loose check that matches the server's validator; the server is the authority.
const EMAIL = /^[^\s@]+@[^\s@]+$/;

/**
 * The sign-up form shared by the community app's /sign-up page and the marketing page
 * (docs/design-system/components/auth-forms.html). It checks what it can before sending; the page
 * creates the account and passes the server's field errors, `unreachable` and `busy` back.
 */
@Component({
  selector: 'ft-sign-up-form',
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    ButtonComponent,
    FormErrorFocusDirective,
    FormFieldComponent,
    StackComponent,
    TextFieldComponent,
  ],
  templateUrl: './sign-up-form.component.html',
  styleUrl: './auth-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignUpFormComponent {
  readonly busy = input(false);
  readonly unreachable = input(false);
  readonly serverErrors = input<SignUpFormErrors>({});
  /** Text of the line between `ftAuthAlternatives` and the fields ("or"); none when null. */
  readonly divider = input<string | null>(null);
  readonly submitted = output<SignUpDetails>();

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, maxTrimmedLength(MAX_NAME)]],
    email: ['', [Validators.required, Validators.pattern(EMAIL)]],
    password: ['', [Validators.required, Validators.minLength(MIN_PASSWORD)]],
  });
  private readonly attempted = signal(false);
  // Re-evaluated on submit; the form's own state is not a signal.
  private readonly version = signal(0);
  private readonly errorFocus = viewChild.required(FormErrorFocusDirective);

  protected readonly errors = computed(() => {
    this.version();
    const server = this.serverErrors();
    return FIELDS.map((field) => ({
      field,
      message: server[field] ?? this.clientError(field),
    })).filter((e) => e.message !== '');
  });

  constructor() {
    const injector = inject(Injector);
    // Server errors arrive after the request: move focus to the summary once it is on screen.
    effect(() => {
      if (!this.unreachable() && !Object.keys(this.serverErrors()).length) return;
      afterNextRender(() => this.errorFocus().focusFirstError(), { injector });
    });
  }

  protected error(field: SignUpField): string {
    return this.errors().find((e) => e.field === field)?.message ?? '';
  }

  protected summaryHeading(): string {
    const count = this.errors().length;
    return `Fix ${count} ${count === 1 ? 'thing' : 'things'} to create your account`;
  }

  protected submit(): void {
    this.attempted.set(true);
    this.version.update((v) => v + 1);
    if (this.form.invalid || this.busy()) return;
    this.submitted.emit(this.form.getRawValue());
  }

  private clientError(field: SignUpField): string {
    if (!this.attempted()) return '';
    const control = this.form.controls[field];
    if (control.hasError('required')) {
      return {
        name: 'Enter your name.',
        email: 'Enter your email address.',
        password: 'Enter a password.',
      }[field];
    }
    if (control.hasError('maxTrimmedLength')) {
      return `Use ${MAX_NAME} characters or fewer for your name.`;
    }
    if (control.hasError('pattern')) return 'Enter an email address like name@example.com.';
    if (control.hasError('minlength')) {
      return 'Use at least 12 characters. A short phrase is easiest to remember.';
    }
    return '';
  }
}

/** Matches the server, which trims the name before checking its length. */
function maxTrimmedLength(max: number): ValidatorFn {
  return (control: AbstractControl<string>): ValidationErrors | null =>
    control.value.trim().length > max ? { maxTrimmedLength: true } : null;
}
