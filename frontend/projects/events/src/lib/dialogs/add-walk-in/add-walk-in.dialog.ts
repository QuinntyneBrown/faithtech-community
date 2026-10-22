import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { CHECK_IN_SERVICE, WalkInResultDto } from '@faithtech-community/api';
import {
  AlertComponent,
  ButtonComponent,
  DialogComponent,
  FormFieldComponent,
  StackComponent,
  SwitchComponent,
  TextFieldComponent,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

export interface AddWalkInData {
  eventId: string;
  /** Filled in from the search that found no one (L2-118 AC3). */
  name?: string;
}

type Field = 'name' | 'email';

export const MAX_WALK_IN_NAME = 100;
const MAX_EMAIL = 256;

/**
 * Adds someone at the door who didn't RSVP (L2-120), matching docs/mocks/dialogs/check-in-walk-in. Client rules
 * mirror AddWalkInValidator; a failed save keeps the input and offers Try again. Closes with the WalkInResultDto.
 */
@Component({
  selector: 'ft-add-walk-in-dialog',
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    ButtonComponent,
    DialogComponent,
    FormFieldComponent,
    StackComponent,
    SwitchComponent,
    TextFieldComponent,
  ],
  templateUrl: './add-walk-in.dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddWalkInDialog {
  protected readonly ref = inject<DialogRef<WalkInResultDto>>(DialogRef);
  protected readonly data = inject<AddWalkInData>(DIALOG_DATA);
  private readonly service = inject(CHECK_IN_SERVICE);

  protected readonly maxName = MAX_WALK_IN_NAME;
  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: [this.data.name ?? ''],
    email: [''],
    checkInNow: [true],
  });
  protected readonly checkInNow = toSignal(this.form.controls.checkInNow.valueChanges, {
    initialValue: true,
  });
  protected readonly errors = signal<Partial<Record<Field, string>>>({});
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);
  /** The name in the failure alert, as it was sent. */
  protected readonly sentName = signal('');

  protected error(field: Field): string {
    return this.errors()[field] ?? '';
  }

  protected async save(): Promise<void> {
    if (this.busy()) return;
    const value = this.form.getRawValue();
    const name = value.name.trim();
    const email = value.email.trim();
    this.errors.set(clientErrors(name, email));
    if (Object.keys(this.errors()).length) return;

    this.busy.set(true);
    this.failed.set(false);
    this.sentName.set(name);
    this.form.disable();
    try {
      this.ref.close(
        await firstValueFrom(
          this.service.addWalkIn(this.data.eventId, {
            name,
            email: email || null,
            checkInNow: value.checkInNow,
          }),
        ),
      );
    } catch (error) {
      const fields = serverErrors(error);
      if (fields) this.errors.set(fields);
      else this.failed.set(true);
    } finally {
      this.form.enable();
      this.busy.set(false);
    }
  }
}

function clientErrors(name: string, email: string): Partial<Record<Field, string>> {
  const errors: Partial<Record<Field, string>> = {};
  if (!name) errors.name = 'Enter their name so the list shows who came.';
  else if (name.length > MAX_WALK_IN_NAME)
    errors.name = 'Use 100 characters or fewer for the name.';
  if (email && (email.length > MAX_EMAIL || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))
    errors.email = 'Enter an email like name@example.com, or leave it empty.';
  return errors;
}

/** Maps the API's validation problem details (PascalCase keys) onto the fields. */
function serverErrors(error: unknown): Partial<Record<Field, string>> | null {
  if (!(error instanceof HttpErrorResponse) || error.status !== 400) return null;
  const errors = (error.error?.errors ?? {}) as Record<string, string[]>;
  const mapped: Partial<Record<Field, string>> = {};
  for (const [key, messages] of Object.entries(errors)) {
    const field = (['name', 'email'] as Field[]).find((f) => f === key.toLowerCase());
    if (field && messages.length) mapped[field] = messages[0];
  }
  return Object.keys(mapped).length ? mapped : null;
}
