import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
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

const MIN_PASSWORD = 12;

interface Problem {
  field: 'password' | 'confirm';
  summary: string;
  message: string;
}

/** Choose a new password from a reset link (L2-004 AC2-3), matching docs/mocks/pages/reset-password. */
@Component({
  selector: 'ft-reset-password-page',
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
  templateUrl: './reset-password.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPasswordPage {
  private readonly auth = inject(AUTH_SERVICE);
  private readonly errorFocus = viewChild.required(FormErrorFocusDirective);

  readonly userId = input('');
  readonly token = input('');

  protected readonly form = inject(NonNullableFormBuilder).group({ password: '', confirm: '' });
  protected readonly problems = signal<Problem[]>([]);
  protected readonly busy = signal(false);
  protected readonly state = signal<'form' | 'updated' | 'expired' | 'failed'>('form');

  protected error(field: Problem['field']): string {
    return this.problems().find((p) => p.field === field)?.message ?? '';
  }

  protected summaryHeading(): string {
    const count = this.problems().length;
    return `Fix ${count} ${count === 1 ? 'thing' : 'things'} to save your password`;
  }

  protected async submit(): Promise<void> {
    const { password, confirm } = this.form.getRawValue();
    this.problems.set(validate(password, confirm));
    if (this.problems().length || this.busy()) return;

    this.busy.set(true);
    try {
      await firstValueFrom(this.auth.resetPassword(this.userId(), this.token(), password));
      this.state.set('updated');
    } catch (error) {
      const errors = (
        error instanceof HttpErrorResponse && error.status === 400 ? error.error?.errors : null
      ) as Record<string, string[]> | null;
      if (errors?.['Password']?.length) {
        const message = errors['Password'][0];
        this.problems.set([{ field: 'password', summary: message, message }]);
        this.errorFocus().focusFirstError();
      } else {
        this.state.set(errors ? 'expired' : 'failed');
      }
    } finally {
      this.busy.set(false);
    }
  }
}

function validate(password: string, confirm: string): Problem[] {
  const problems: Problem[] = [];
  if (password.length < MIN_PASSWORD) {
    problems.push({
      field: 'password',
      summary: 'Password needs at least 12 characters',
      message: 'Use at least 12 characters.',
    });
  }
  if (confirm !== password) {
    problems.push({
      field: 'confirm',
      summary: 'Passwords don’t match',
      message: 'This doesn’t match the password above.',
    });
  }
  return problems;
}
