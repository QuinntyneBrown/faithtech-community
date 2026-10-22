import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RESOURCES_SERVICE, ResourceDto } from '@faithtech-community/api';
import {
  AlertComponent,
  ButtonComponent,
  DialogComponent,
  formatDay,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

const PURGE_DAYS = 30;

/**
 * Confirms archiving a resource (L2-063 AC1, AC6), as in docs/mocks/dialogs/archive-resource.
 * Focus starts on Cancel. Closes with the date it will be deleted for good.
 */
@Component({
  selector: 'ft-archive-resource-dialog',
  imports: [AlertComponent, ButtonComponent, DialogComponent],
  templateUrl: './archive-resource.dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArchiveResourceDialog {
  protected readonly ref = inject<DialogRef<string>>(DialogRef);
  protected readonly resource = inject<ResourceDto>(DIALOG_DATA);
  private readonly resources = inject(RESOURCES_SERVICE);

  protected readonly busy = signal(false);
  protected readonly failed = signal(false);
  protected readonly purgeAt = new Date(Date.now() + PURGE_DAYS * 24 * 60 * 60 * 1000);
  protected readonly purgeDay = formatDay(this.purgeAt);

  protected async confirm(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.failed.set(false);
    try {
      await firstValueFrom(this.resources.archive(this.resource.id));
      this.ref.close(this.purgeAt.toISOString());
    } catch {
      this.failed.set(true);
    } finally {
      this.busy.set(false);
    }
  }
}
