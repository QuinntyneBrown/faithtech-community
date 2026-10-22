import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import {
  LOGGED_ACTIVITY_KINDS,
  LoggedActivityKind,
  PARTNERS_SERVICE,
  PartnerActivityDto,
} from '@faithtech-community/api';
import {
  AlertComponent,
  ButtonComponent,
  DialogComponent,
  FormFieldComponent,
  GridComponent,
  RadioComponent,
  RadioGroupComponent,
  StackComponent,
  TextFieldComponent,
  TextareaComponent,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

export interface LogActivityData {
  partnerId: string;
  name: string;
}

type Field = 'kind' | 'summary' | 'occurredOn' | 'nextStep' | 'nextStepDue';
const FIELDS: Field[] = ['kind', 'summary', 'occurredOn', 'nextStep', 'nextStepDue'];

export const MAX_SUMMARY = 2000;
export const MAX_NEXT_STEP = 200;

/** yyyy-MM-dd for the lead's local today, the latest date an activity can have happened. */
export function localToday(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Logs a call, email, meeting or note on a partner's shared timeline (L2-085), matching
 * docs/mocks/dialogs/log-activity. Client rules mirror the API's validator; a failed save keeps the
 * input and offers Try again. Closes with the logged activity.
 */
@Component({
  selector: 'ft-log-activity-dialog',
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    ButtonComponent,
    DialogComponent,
    FormFieldComponent,
    GridComponent,
    RadioComponent,
    RadioGroupComponent,
    StackComponent,
    TextFieldComponent,
    TextareaComponent,
  ],
  templateUrl: './log-activity.dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogActivityDialog {
  protected readonly ref = inject<DialogRef<PartnerActivityDto>>(DialogRef);
  protected readonly data = inject<LogActivityData>(DIALOG_DATA);
  private readonly partners = inject(PARTNERS_SERVICE);

  protected readonly kinds = LOGGED_ACTIVITY_KINDS;
  protected readonly today = localToday();
  protected readonly maxSummary = MAX_SUMMARY;
  protected readonly maxNextStep = MAX_NEXT_STEP;
  protected readonly form = inject(FormBuilder).nonNullable.group({
    kind: ['Call' as LoggedActivityKind],
    summary: [''],
    occurredOn: [this.today],
    occurredAt: [''],
    nextStep: [''],
    nextStepDue: [''],
  });
  protected readonly kind = toSignal(this.form.controls.kind.valueChanges, {
    initialValue: this.form.controls.kind.value,
  });
  protected readonly errors = signal<Partial<Record<Field, string>>>({});
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);

  protected error(field: Field): string {
    return this.errors()[field] ?? '';
  }

  protected async save(): Promise<void> {
    if (this.busy()) return;
    const value = this.form.getRawValue();
    this.errors.set(this.clientErrors(value));
    if (Object.keys(this.errors()).length) return;

    this.busy.set(true);
    this.failed.set(false);
    this.form.disable();
    const nextStep = value.nextStep.trim() || null;
    try {
      this.ref.close(
        await firstValueFrom(
          this.partners.logActivity(this.data.partnerId, {
            kind: value.kind,
            summary: value.summary.trim(),
            occurredOn: value.occurredOn,
            occurredAt: value.occurredAt || null,
            nextStep,
            nextStepDue: nextStep ? value.nextStepDue || null : null,
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

  private clientErrors(
    value: ReturnType<typeof this.form.getRawValue>,
  ): Partial<Record<Field, string>> {
    const errors: Partial<Record<Field, string>> = {};
    const summary = value.summary.trim();
    if (!summary) errors.summary = 'Say what happened, in a sentence or two.';
    else if (summary.length > MAX_SUMMARY)
      errors.summary = 'Use 2,000 characters or fewer for what happened.';
    if (!value.occurredOn) errors.occurredOn = 'Enter the date it happened.';
    else if (value.occurredOn > this.today) errors.occurredOn = 'Choose today or an earlier date.';
    const nextStep = value.nextStep.trim();
    if (nextStep.length > MAX_NEXT_STEP)
      errors.nextStep = 'Use 200 characters or fewer for the next step.';
    if (value.nextStepDue && !nextStep)
      errors.nextStepDue = 'Add the next step, or clear its due date.';
    return errors;
  }
}

/** Maps the API's validation problem details (PascalCase keys) onto the fields. */
function serverErrors(error: unknown): Partial<Record<Field, string>> | null {
  if (!(error instanceof HttpErrorResponse) || error.status !== 400) return null;
  const errors = (error.error?.errors ?? {}) as Record<string, string[]>;
  const mapped: Partial<Record<Field, string>> = {};
  for (const [key, messages] of Object.entries(errors)) {
    const field = FIELDS.find((f) => f.toLowerCase() === key.toLowerCase());
    if (field && messages.length) mapped[field] = messages[0];
  }
  return Object.keys(mapped).length ? mapped : null;
}
