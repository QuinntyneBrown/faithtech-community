import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { AgendaItem, EVENT_HUBS_SERVICE } from '@faithtech-community/api';
import {
  AlertComponent,
  ButtonComponent,
  ClusterComponent,
  DialogComponent,
  FormFieldComponent,
  InlineMessageComponent,
  ListComponent,
  ListItemComponent,
  ReorderableActionsDirective,
  ReorderableItem,
  ReorderableListComponent,
  StackComponent,
  StepperComponent,
  TextFieldComponent,
  TextareaComponent,
  formatTime,
} from '@faithtech-community/components';

import {
  HubAgendaComponent,
  HubSectionWizardData,
  SectionSaver,
  agendaSummary,
  inTimeOrder,
  outsideWarning,
  parseSchedule,
  sectionContent,
  timeInputInstant,
  timeInputValue,
} from '../../hub-sections';

const STEPS = ['Rows', 'Review'] as const;
const MAX_ROWS = 40;
const MAX_TITLE = 100;
const MAX_DETAIL = 200;

interface Row extends AgendaItem {
  id: string;
}

type Action = 'next' | 'later' | 'finish';

let next = 0;

/**
 * The Agenda wizard (L2-159, L2-157), matching docs/mocks/dialogs/hub-agenda: step 1 lists the rows, reorderable, with
 * Edit and Remove, and adds one row at a time or a pasted schedule; step 2 reviews the agenda with its display. Next,
 * Save and finish later and Save each save the rows as shown (save as you go). Closes with true once saved and done.
 */
@Component({
  selector: 'ft-hub-agenda-dialog',
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    ButtonComponent,
    ClusterComponent,
    DialogComponent,
    FormFieldComponent,
    HubAgendaComponent,
    InlineMessageComponent,
    ListComponent,
    ListItemComponent,
    ReorderableActionsDirective,
    ReorderableListComponent,
    StackComponent,
    StepperComponent,
    TextFieldComponent,
    TextareaComponent,
  ],
  templateUrl: './hub-agenda.dialog.html',
  styleUrls: ['../hub-wizard.scss', './hub-agenda.dialog.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HubAgendaDialog {
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly hub = inject<HubSectionWizardData>(DIALOG_DATA).hub;
  protected readonly saver = new SectionSaver(
    inject(EVENT_HUBS_SERVICE),
    this.hub.eventId,
    'Agenda',
  );
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly steps = STEPS;
  protected readonly statusId = `hub-agenda-step-${++next}`;
  protected readonly questionId = `hub-agenda-q-${next}`;
  protected readonly maxTitle = MAX_TITLE;
  protected readonly maxDetail = MAX_DETAIL;
  protected readonly step = signal<1 | 2>(1);
  protected readonly busy = signal<Action | null>(null);
  private last: Action = 'next';
  private ids = 0;

  protected readonly rows = signal<readonly Row[]>(
    (sectionContent(this.hub, 'Agenda')?.items ?? []).map((item) => this.row(item)),
  );
  protected readonly items = computed<ReorderableItem[]>(() =>
    this.rows().map((r) => ({
      id: r.id,
      title: r.title,
      lead: formatTime(r.startsAt),
      meta: r.detail ?? undefined,
      warning: outsideWarning(r.startsAt, this.hub.event),
    })),
  );
  protected readonly summary = computed(() => agendaSummary(this.rows()));
  /** Messages the server gave for the rows, such as "You can add up to 40 rows." */
  protected readonly rowErrors = computed(() =>
    Object.entries(this.saver.errors())
      .filter(([path]) => path.startsWith('items'))
      .map(([, message]) => message),
  );

  // Adding or editing one row.
  protected readonly form = this.fb.group({ time: [''], what: [''], detail: [''] });
  protected readonly editing = signal<string | null>(null);
  protected readonly timeError = signal('');
  protected readonly whatError = signal('');
  protected readonly detailError = signal('');
  protected readonly rowsError = signal('');

  // Pasting a schedule.
  protected readonly pasting = signal(false);
  protected readonly schedule = this.fb.control('');
  protected readonly parsed = signal<{ rows: AgendaItem[]; unreadable: string[] } | null>(null);
  protected readonly found = computed(() => {
    const n = this.parsed()?.rows.length ?? 0;
    return `We found ${n} ${n === 1 ? 'row' : 'rows'}`;
  });
  protected readonly unreadable = computed(() => {
    const lines = this.parsed()?.unreadable ?? [];
    if (lines.length === 0) return '';
    const n = lines.length;
    return `We couldn’t read ${n} ${n === 1 ? 'line' : 'lines'}: ${lines.map((l) => `‘${l}’`).join(', ')}`;
  });
  protected readonly parsedRows = computed(() =>
    (this.parsed()?.rows ?? []).map((r) => `${formatTime(r.startsAt)} ${r.title}`),
  );

  /** Add row, or Update row while editing (L2-159 AC2): in time order. */
  protected addRow(): void {
    const { time, what, detail } = this.form.getRawValue();
    const startsAt = timeInputInstant(time, this.hub.event);
    const title = what.trim();
    this.timeError.set(startsAt ? '' : 'Enter a time.');
    this.whatError.set(
      !title
        ? 'Say what’s happening.'
        : title.length > MAX_TITLE
          ? 'Use 100 characters or fewer.'
          : '',
    );
    this.detailError.set(detail.trim().length > MAX_DETAIL ? 'Use 200 characters or fewer.' : '');
    const editing = this.editing();
    this.rowsError.set(
      !editing && this.rows().length >= MAX_ROWS ? 'You can add up to 40 rows.' : '',
    );
    if (this.timeError() || this.whatError() || this.detailError() || this.rowsError()) return;

    const row = this.row({ startsAt: startsAt!, title, detail: detail.trim() || null });
    if (editing) {
      this.rows.update((rows) => rows.map((r) => (r.id === editing ? { ...row, id: editing } : r)));
      this.editing.set(null);
    } else {
      this.rows.update((rows) => inTimeOrder(rows, row));
    }
    this.form.reset();
  }

  protected edit(id: string): void {
    const row = this.rows().find((r) => r.id === id);
    if (!row) return;
    this.pasting.set(false);
    this.editing.set(id);
    this.form.setValue({
      time: timeInputValue(row.startsAt),
      what: row.title,
      detail: row.detail ?? '',
    });
  }

  protected remove(id: string): void {
    this.rows.update((rows) => rows.filter((r) => r.id !== id));
    if (this.editing() === id) {
      this.editing.set(null);
      this.form.reset();
    }
  }

  protected reordered(ids: string[]): void {
    const rows = this.rows();
    this.rows.set(ids.map((id) => rows.find((r) => r.id === id)!));
  }

  protected paste(): void {
    this.editing.set(null);
    this.form.reset();
    this.pasting.set(true);
  }

  /** Read schedule (L2-159 AC3): nothing is added until Add these rows. */
  protected read(): void {
    this.parsed.set(parseSchedule(this.schedule.value, this.hub.event));
  }

  protected addParsed(): void {
    const parsed = this.parsed()?.rows ?? [];
    this.rows.update((rows) =>
      parsed.reduce<readonly Row[]>((all, item) => inTimeOrder(all, this.row(item)), rows),
    );
    this.stopPasting();
  }

  protected stopPasting(): void {
    this.pasting.set(false);
    this.parsed.set(null);
    this.schedule.reset();
  }

  /** Next, Save and finish later, or Save: saves the rows as shown, then moves on or closes. */
  protected async save(action: Action): Promise<void> {
    if (this.busy()) return;
    this.last = action;
    this.busy.set(action);
    const items = this.rows().map(({ startsAt, title, detail }) => ({ startsAt, title, detail }));
    const saved = await this.saver.save({ items });
    this.busy.set(null);
    if (!saved) {
      if (!this.saver.failed()) this.step.set(1);
      return;
    }
    if (action === 'next') this.step.set(2);
    else this.ref.close(true);
  }

  protected retry(): void {
    void this.save(this.last);
  }

  private row(item: AgendaItem): Row {
    return { ...item, id: `row-${++this.ids}` };
  }
}
