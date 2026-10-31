import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { EVENTS_SERVICE, OrganisationNames, problemDetails } from '@faithtech-community/api';
import {
  AlertComponent,
  ButtonComponent,
  DialogComponent,
  FormFieldComponent,
  StackComponent,
  TextareaComponent,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

export interface CancelEventData {
  eventId: string;
  title: string;
  /** Everyone who RSVP'd, members and guests: they all get an email. */
  rsvpCount: number;
  /** Members who RSVP'd: they also get an in-app notification. */
  memberCount: number;
}

const MAX_REASON = 500;

/**
 * Confirms cancelling an event with the message attendees will read (L2-025), matching
 * docs/mocks/dialogs/cancel-event. Closes with true once the event is cancelled.
 */
@Component({
  selector: 'ft-cancel-event-dialog',
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    ButtonComponent,
    DialogComponent,
    FormFieldComponent,
    StackComponent,
    TextareaComponent,
  ],
  templateUrl: './cancel-event.dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CancelEventDialog {
  protected readonly organisation = inject(OrganisationNames);
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly data = inject<CancelEventData>(DIALOG_DATA);
  private readonly events = inject(EVENTS_SERVICE);

  protected readonly reason = new FormControl('', { nonNullable: true });
  private readonly reasonValue = toSignal(this.reason.valueChanges, { initialValue: '' });
  protected readonly submitted = signal(false);
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);
  protected readonly refusal = signal<string | null>(null);

  protected readonly description = computed(() => {
    const { rsvpCount, memberCount } = this.data;
    const page = 'The event page stays up marked as cancelled.';
    if (rsvpCount === 0) return `No one has RSVP’d yet. ${page}`;
    const everyone =
      rsvpCount === 1
        ? 'The 1 person who RSVP’d gets an email'
        : `All ${rsvpCount} people who RSVP’d get an email`;
    const members =
      memberCount === 0
        ? ''
        : memberCount === rsvpCount
          ? `; ${memberCount === 1 ? 'they also get' : 'members also get'} an in-app notification`
          : `; the ${memberCount} ${memberCount === 1 ? 'member also gets' : 'members also get'} an in-app notification`;
    return `${everyone}${members}. ${page}`;
  });

  protected readonly error = computed(() => {
    if (!this.submitted()) return '';
    const reason = this.reasonValue().trim();
    if (!reason) return 'Tell attendees why, so they aren’t left guessing.';
    return reason.length > MAX_REASON
      ? `Use ${MAX_REASON} characters or fewer for the message.`
      : '';
  });

  protected async confirm(): Promise<void> {
    this.submitted.set(true);
    if (this.error() || this.busy()) return;
    this.busy.set(true);
    this.failed.set(false);
    this.refusal.set(null);
    try {
      await firstValueFrom(this.events.cancelEvent(this.data.eventId, this.reason.value.trim()));
      this.ref.close(true);
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status >= 400 && error.status < 500) {
        this.refusal.set(problemDetails(error)?.detail ?? 'You can’t cancel this event.');
      } else {
        this.failed.set(true);
      }
    } finally {
      this.busy.set(false);
    }
  }
}
