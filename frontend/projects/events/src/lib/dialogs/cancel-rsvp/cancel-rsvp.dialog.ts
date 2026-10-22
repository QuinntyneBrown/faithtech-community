import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { EVENTS_SERVICE } from '@faithtech-community/api';
import { AlertComponent, ButtonComponent, DialogComponent } from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

export interface CancelRsvpData {
  eventId: string;
  hostName: string | null;
}

/**
 * Confirms cancelling the caller's RSVP (L2-022 AC2), matching docs/mocks/dialogs/cancel-rsvp. Keep my RSVP
 * is the safe choice and takes focus. Closes with true once the RSVP is gone.
 */
@Component({
  selector: 'ft-cancel-rsvp-dialog',
  imports: [AlertComponent, ButtonComponent, DialogComponent],
  templateUrl: './cancel-rsvp.dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CancelRsvpDialog {
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly data = inject<CancelRsvpData>(DIALOG_DATA);
  private readonly events = inject(EVENTS_SERVICE);

  protected readonly busy = signal(false);
  protected readonly failed = signal(false);
  protected readonly description = computed(() => {
    const host = this.data.hostName?.split(' ')[0];
    return `${host ?? 'The hosts'} will see one fewer person coming. You can RSVP again any time before the event.`;
  });

  protected async confirm(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.failed.set(false);
    try {
      await firstValueFrom(this.events.cancelRsvp(this.data.eventId));
      this.ref.close(true);
    } catch (error) {
      // Already gone, for example cancelled in another tab: the outcome the person wanted.
      if (error instanceof HttpErrorResponse && error.status === 404) this.ref.close(true);
      else this.failed.set(true);
    } finally {
      this.busy.set(false);
    }
  }
}
