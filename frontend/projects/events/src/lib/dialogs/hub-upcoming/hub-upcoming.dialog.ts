import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { EVENT_HUBS_SERVICE } from '@faithtech-community/api';
import {
  AlertComponent,
  ButtonComponent,
  DialogComponent,
  FormFieldComponent,
  SelectComponent,
  SelectOption,
  StackComponent,
} from '@faithtech-community/components';

import {
  HubSectionWizardData,
  HubUpcomingComponent,
  SectionSaver,
  sectionContent,
} from '../../hub-sections';

const COUNTS: SelectOption[] = [1, 2, 3, 4, 5, 6].map((n) => ({
  value: String(n),
  label: String(n),
}));
let next = 0;

/**
 * The Upcoming events wizard (L2-162 AC1), matching docs/mocks/dialogs/hub-upcoming: Show from 1 to 6, 3 by default,
 * and the events the hub would show now. The events themselves are read live; the lead only picks how many. Closes
 * with true once saved.
 */
@Component({
  selector: 'ft-hub-upcoming-dialog',
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    ButtonComponent,
    DialogComponent,
    FormFieldComponent,
    HubUpcomingComponent,
    SelectComponent,
    StackComponent,
  ],
  templateUrl: './hub-upcoming.dialog.html',
  styleUrl: '../hub-wizard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HubUpcomingDialog {
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly hub = inject<HubSectionWizardData>(DIALOG_DATA).hub;
  protected readonly saver = new SectionSaver(
    inject(EVENT_HUBS_SERVICE),
    this.hub.eventId,
    'UpcomingEvents',
  );

  protected readonly questionId = `hub-upcoming-q-${++next}`;
  protected readonly previewId = `hub-upcoming-now-${next}`;
  protected readonly counts = COUNTS;
  protected readonly count = inject(NonNullableFormBuilder).control(
    String(sectionContent(this.hub, 'UpcomingEvents')?.count ?? 3),
  );
  private readonly chosen = toSignal(this.count.valueChanges, { initialValue: this.count.value });
  /** What the hub would show now; the hub holds as many as its saved count, so a larger pick shows those. */
  protected readonly shown = computed(() =>
    this.hub.upcomingEvents.slice(0, Number(this.chosen())),
  );

  protected async save(): Promise<void> {
    if (await this.saver.save({ count: Number(this.count.value) })) this.ref.close(true);
  }
}
