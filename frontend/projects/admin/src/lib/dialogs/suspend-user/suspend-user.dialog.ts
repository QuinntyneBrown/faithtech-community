import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ADMIN_USERS_SERVICE, problemDetails } from '@faithtech-community/api';
import {
  AlertComponent,
  ButtonComponent,
  DialogComponent,
  FormFieldComponent,
  StackComponent,
  TextareaComponent,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

export interface SuspendUserData {
  /** Profile id. */
  id: string;
  name: string;
}

/**
 * Confirms suspending a user with a reason (L2-039), matching docs/mocks/dialogs/suspend-user.
 * Closes with true once the user is suspended.
 */
@Component({
  selector: 'ft-suspend-user-dialog',
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    ButtonComponent,
    DialogComponent,
    FormFieldComponent,
    StackComponent,
    TextareaComponent,
  ],
  templateUrl: './suspend-user.dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SuspendUserDialog {
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly data = inject<SuspendUserData>(DIALOG_DATA);
  private readonly users = inject(ADMIN_USERS_SERVICE);

  protected readonly reason = new FormControl('', { nonNullable: true });
  private readonly reasonValue = toSignal(this.reason.valueChanges, { initialValue: '' });
  protected readonly submitted = signal(false);
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);
  protected readonly refusal = signal<string | null>(null);

  protected readonly error = computed(() => {
    if (!this.submitted()) return '';
    const reason = this.reasonValue().trim();
    if (!reason) return 'Give a reason so other admins understand.';
    return reason.length > 500 ? 'Use 500 characters or fewer for the reason.' : '';
  });

  protected async confirm(): Promise<void> {
    this.submitted.set(true);
    if (this.error() || this.busy()) return;
    this.busy.set(true);
    this.failed.set(false);
    this.refusal.set(null);
    try {
      await firstValueFrom(this.users.suspend(this.data.id, this.reason.value.trim()));
      this.ref.close(true);
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status >= 400 && error.status < 500) {
        this.refusal.set(problemDetails(error)?.detail ?? 'You can’t suspend this account.');
      } else {
        this.failed.set(true);
      }
    } finally {
      this.busy.set(false);
    }
  }
}
