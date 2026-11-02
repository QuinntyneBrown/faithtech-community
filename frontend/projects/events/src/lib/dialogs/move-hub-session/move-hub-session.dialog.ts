import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import {
  AgendaItem,
  EVENT_HUBS_SERVICE,
  EventHubDto,
  problemDetails,
} from '@faithtech-community/api';
import {
  AlertComponent,
  ButtonComponent,
  CheckboxComponent,
  CheckboxGroupComponent,
  DialogComponent,
  FormErrorFocusDirective,
  FormFieldComponent,
  SelectComponent,
  SelectOption,
  StackComponent,
  TextFieldComponent,
  formatTime,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

import {
  firstUpcomingRow,
  sectionContent,
  shiftOffer,
  timeInputInstant,
  timeInputValue,
} from '../../hub-sections';

export interface MoveHubSessionData {
  hub: EventHubDto;
}

/** Closes with what moved, for the toast; undefined when cancelled. */
export interface MovedSession {
  title: string;
  startsAt: string;
  later: number;
}

/**
 * Move a session (L2-190), matching docs/mocks/dialogs/move-hub-session: pick an agenda row and its new time; when the time
 * changes and rows follow it, offer to move them by the same amount, ticked. The server applies the move (ADR 0044).
 */
@Component({
  selector: 'ft-move-hub-session-dialog',
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    ButtonComponent,
    CheckboxComponent,
    CheckboxGroupComponent,
    DialogComponent,
    FormErrorFocusDirective,
    FormFieldComponent,
    SelectComponent,
    StackComponent,
    TextFieldComponent,
  ],
  templateUrl: './move-hub-session.dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MoveHubSessionDialog {
  protected readonly ref = inject<DialogRef<MovedSession>>(DialogRef);
  private readonly data = inject<MoveHubSessionData>(DIALOG_DATA);
  private readonly hubs = inject(EVENT_HUBS_SERVICE);
  private readonly errorFocus = viewChild.required(FormErrorFocusDirective);

  private readonly rows: AgendaItem[] = sectionContent(this.data.hub, 'Agenda')?.items ?? [];
  private readonly first = firstUpcomingRow(this.rows, new Date());
  protected readonly options: SelectOption[] = this.rows.map((r, i) => ({
    value: String(i),
    label: `${formatTime(r.startsAt)} · ${r.title}`,
  }));
  protected readonly form = inject(NonNullableFormBuilder).group({
    session: [String(this.first)],
    time: [this.rows[this.first] ? timeInputValue(this.rows[this.first].startsAt) : ''],
    shift: [['later']],
  });
  private readonly session = toSignal(this.form.controls.session.valueChanges, {
    initialValue: this.form.controls.session.value,
  });
  private readonly time = toSignal(this.form.controls.time.valueChanges, {
    initialValue: this.form.controls.time.value,
  });

  protected readonly busy = signal(false);
  protected readonly failed = signal(false);
  protected readonly sessionError = signal('');
  protected readonly timeError = signal('');

  private readonly index = computed(() => Number(this.session()));
  /** The new instant, or null while the time is empty or unreadable. */
  private readonly startsAt = computed(() => timeInputInstant(this.time(), this.data.hub.event));
  /** Minutes the chosen row moves by; 0 until the time changes. */
  private readonly minutes = computed(() => {
    const row = this.rows[this.index()];
    const at = this.startsAt();
    return row && at ? Math.round((Date.parse(at) - Date.parse(row.startsAt)) / 60_000) : 0;
  });
  protected readonly later = computed(() => this.rows.slice(this.index() + 1));
  /** L2-190 AC2: offered only when the time changed and rows follow. */
  protected readonly offer = computed(() =>
    this.minutes() !== 0 && this.later().length
      ? {
          label: shiftOffer(this.later().length, this.minutes()),
          rows: this.later()
            .map((r) => r.title)
            .join(', '),
        }
      : null,
  );

  constructor() {
    // Choosing another session starts from its own time.
    this.form.controls.session.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      const row = this.rows[Number(value)];
      if (row) this.form.controls.time.setValue(timeInputValue(row.startsAt));
    });
  }

  protected async move(): Promise<void> {
    if (this.busy()) return;
    const startsAt = this.startsAt();
    this.sessionError.set('');
    this.timeError.set(startsAt ? '' : 'Enter a time.');
    if (!startsAt) {
      this.errorFocus().focusFirstError();
      return;
    }

    const shiftLater = !!this.offer() && this.form.controls.shift.value.includes('later');
    this.busy.set(true);
    this.failed.set(false);
    try {
      await firstValueFrom(
        this.hubs.moveSession(this.data.hub.eventId, { index: this.index(), startsAt, shiftLater }),
      );
      this.ref.close({
        title: this.rows[this.index()].title,
        startsAt,
        later: shiftLater ? this.later().length : 0,
      });
    } catch (error) {
      const errors =
        error instanceof HttpErrorResponse && error.status === 400
          ? problemDetails(error)?.errors
          : undefined;
      if (errors) {
        this.sessionError.set(errors['index']?.[0] ?? '');
        this.timeError.set(errors['startsAt']?.[0] ?? '');
        this.errorFocus().focusFirstError();
      } else {
        this.failed.set(true);
      }
    } finally {
      this.busy.set(false);
    }
  }
}
