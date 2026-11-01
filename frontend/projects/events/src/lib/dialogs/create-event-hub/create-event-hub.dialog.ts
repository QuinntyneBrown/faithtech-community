import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { EVENT_HUBS_SERVICE, HubSectionKind, problemDetails } from '@faithtech-community/api';
import {
  AlertComponent,
  ButtonComponent,
  CheckboxComponent,
  CheckboxGroupComponent,
  DescriptionListComponent,
  DescriptionListItemComponent,
  DialogComponent,
  IconComponent,
  RadioComponent,
  RadioGroupComponent,
  StackComponent,
  StepperComponent,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

import { HUB_SECTIONS } from '../../hub-sections';

export interface CreateEventHubData {
  eventId: string;
  title: string;
  /** As the event page shows them: the hub reads them from the event and stores none (L2-153 AC3). */
  when: string;
  where: string;
  rsvpLink: string;
}

/** How the wizard ended: whether a hub exists now, and whether the lead chose to fill it in. */
export interface CreateEventHubResult {
  created: boolean;
  next: 'fill-in' | 'later' | 'closed';
}

const STEPS = ['Event', 'Starting point', 'Sections', 'Done'] as const;

/** Starting points other than Blank arrive with templates (slice 45). */
const COMING_SOON = ['Hackathon', 'Meetup', 'Workshop', 'Copy a past hub'];

/**
 * The Create event hub wizard (L2-153), matching docs/mocks/dialogs/create-event-hub: four steps over ft-stepper, one
 * question each, with Save and finish later on every step. Step 1's Next creates the Draft hub; every later Next and
 * Save and finish later saves the starting point and which sections are shown (save as you go).
 */
@Component({
  selector: 'ft-create-event-hub-dialog',
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    ButtonComponent,
    CheckboxComponent,
    CheckboxGroupComponent,
    DescriptionListComponent,
    DescriptionListItemComponent,
    DialogComponent,
    IconComponent,
    RadioComponent,
    RadioGroupComponent,
    StackComponent,
    StepperComponent,
  ],
  templateUrl: './create-event-hub.dialog.html',
  styleUrl: './create-event-hub.dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateEventHubDialog {
  protected readonly ref = inject<DialogRef<CreateEventHubResult>>(DialogRef);
  protected readonly data = inject<CreateEventHubData>(DIALOG_DATA);
  private readonly hubs = inject(EVENT_HUBS_SERVICE);

  protected readonly steps = STEPS;
  protected readonly comingSoon = COMING_SOON;
  protected readonly sections = HUB_SECTIONS;
  protected readonly statusId = `create-event-hub-step-${this.data.eventId}`;

  protected readonly step = signal(1);
  protected readonly busy = signal<'next' | 'later' | null>(null);
  protected readonly failed = signal(false);
  protected readonly refusal = signal<string | null>(null);
  private readonly created = signal(false);
  /** What to retry after a failure. */
  private lastAction: 'next' | 'later' = 'next';

  protected readonly startingPoint = new FormControl('blank', { nonNullable: true });
  protected readonly shown = new FormControl<readonly string[]>(
    HUB_SECTIONS.map((s) => s.kind),
    { nonNullable: true },
  );

  protected back(): void {
    this.clearErrors();
    this.step.update((s) => Math.max(1, s - 1));
  }

  protected next(): Promise<void> {
    return this.run('next');
  }

  protected later(): Promise<void> {
    return this.run('later');
  }

  protected retry(): Promise<void> {
    return this.run(this.lastAction);
  }

  protected fillIn(): void {
    this.ref.close({ created: true, next: 'fill-in' });
  }

  protected close(): void {
    this.ref.close({ created: this.created(), next: 'closed' });
  }

  private async run(action: 'next' | 'later'): Promise<void> {
    if (this.busy()) return;
    this.lastAction = action;
    this.clearErrors();
    this.busy.set(action);
    try {
      if (!this.created()) {
        await firstValueFrom(this.hubs.create(this.data.eventId));
        this.created.set(true);
      }
      if (this.step() > 1) await this.save();
      if (action === 'later') {
        this.ref.close({ created: true, next: 'later' });
      } else {
        this.step.update((s) => s + 1);
      }
    } catch (error) {
      if (error instanceof HttpErrorResponse && (error.status === 400 || error.status === 409)) {
        this.refusal.set(refusalOf(error));
      } else {
        this.failed.set(true);
      }
    } finally {
      this.busy.set(null);
    }
  }

  private save(): Promise<void> {
    const shown = this.shown.value;
    return firstValueFrom(
      this.hubs.save(this.data.eventId, {
        templateKey: this.startingPoint.value,
        sections: HUB_SECTIONS.map((s) => ({
          kind: s.kind as HubSectionKind,
          visible: shown.includes(s.kind),
        })),
      }),
    );
  }

  private clearErrors(): void {
    this.failed.set(false);
    this.refusal.set(null);
  }
}

/** The 409's detail, or the first field error of a 400. */
function refusalOf(error: HttpErrorResponse): string {
  const problem = problemDetails(error);
  const firstError = Object.values(problem?.errors ?? {})[0]?.[0];
  return problem?.detail ?? firstError ?? 'We couldn’t save your hub.';
}
