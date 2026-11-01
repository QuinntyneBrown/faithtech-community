import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { EVENT_HUBS_SERVICE } from '@faithtech-community/api';
import { AlertComponent, ButtonComponent, DialogComponent } from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

export interface UnpublishHubData {
  eventId: string;
}

/**
 * Confirms unpublishing a hub (L2-164 AC3), matching docs/mocks/dialogs/unpublish-hub. Closes with true once
 * the hub is a draft again; a failure keeps it open with Try again.
 */
@Component({
  selector: 'ft-unpublish-hub-dialog',
  imports: [AlertComponent, ButtonComponent, DialogComponent],
  templateUrl: './unpublish-hub.dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UnpublishHubDialog {
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  private readonly data = inject<UnpublishHubData>(DIALOG_DATA);
  private readonly hubs = inject(EVENT_HUBS_SERVICE);

  protected readonly busy = signal(false);
  protected readonly failed = signal(false);

  protected async confirm(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.failed.set(false);
    try {
      await firstValueFrom(this.hubs.unpublish(this.data.eventId));
    } catch {
      this.failed.set(true);
      this.busy.set(false);
      return;
    }
    this.ref.close(true);
  }
}
