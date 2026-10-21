import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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

type Field = 'name' | 'email' | 'password';

const FIELDS: Field[] = ['name', 'email', 'password'];
const MIN_PASSWORD = 12;
// Loose check that matches the server's validator; the server is the authority.
const EMAIL = /^[^\s@]+@[^\s@]+$/;

/** Create an account (L2-001), matching docs/mocks/pages/sign-up. */
@Component({
  selector: 'ft-sign-up-page',
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
  templateUrl: './sign-up.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignUpPage {
  private readonly auth = inject(AUTH_SERVICE);
  private readonly errorFocus = viewChild.required(FormErrorFocusDirective);

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.pattern(EMAIL)]],
    password: ['', [Validators.required, Validators.minLength(MIN_PASSWORD)]],
  });
  protected readonly submitted = signal(false);
  protected readonly busy = signal(false);
  protected readonly unreachable = signal(false);
  protected readonly sentTo = signal<string | null>(null);
  private readonly serverErrors = signal<Partial<Record<Field, string>>>({});
  // Re-evaluated on submit; the form's own state is not a signal.
  private readonly version = signal(0);

  protected readonly errors = computed(() => {
    this.version();
    const server = this.serverErrors();
    return FIELDS.map((field) => ({
      field,
      message: server[field] ?? this.clientError(field),
    })).filter((e) => e.message !== '');
  });

  protected error(field: Field): string {
    return this.errors().find((e) => e.field === field)?.message ?? '';
  }

  protected summaryHeading(): string {
    const count = this.errors().length;
    return `Fix ${count} ${count === 1 ? 'thing' : 'things'} to create your account`;
  }

  protected async submit(): Promise<void> {
    this.submitted.set(true);
    this.serverErrors.set({});
    this.unreachable.set(false);
    this.version.update((v) => v + 1);
    if (this.form.invalid || this.busy()) return;

    const request = this.form.getRawValue();
    this.busy.set(true);
    try {
      await firstValueFrom(this.auth.signUp(request));
      this.sentTo.set(request.email);
    } catch (error) {
      const fieldErrors = validationErrors(error);
      if (fieldErrors) this.serverErrors.set(fieldErrors);
      else this.unreachable.set(true);
      this.errorFocus().focusFirstError();
    } finally {
      this.busy.set(false);
    }
  }

  private clientError(field: Field): string {
    if (!this.submitted()) return '';
    const control = this.form.controls[field];
    if (control.hasError('required')) {
      return {
        name: 'Enter your name.',
        email: 'Enter your email address.',
        password: 'Enter a password.',
      }[field];
    }
    if (control.hasError('pattern')) return 'Enter an email address like name@example.com.';
    if (control.hasError('minlength')) {
      return 'Use at least 12 characters. A short phrase is easiest to remember.';
    }
    return '';
  }
}

/** Maps the API's validation problem details (PascalCase keys) onto the form's fields. */
function validationErrors(error: unknown): Partial<Record<Field, string>> | null {
  if (!(error instanceof HttpErrorResponse) || error.status !== 400) return null;
  const errors = (error.error?.errors ?? {}) as Record<string, string[]>;
  const mapped: Partial<Record<Field, string>> = {};
  for (const [key, messages] of Object.entries(errors)) {
    const field = key.toLowerCase() as Field;
    if (FIELDS.includes(field) && messages.length) mapped[field] = messages[0];
  }
  return Object.keys(mapped).length ? mapped : null;
}
