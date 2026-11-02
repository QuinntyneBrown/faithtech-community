import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AlertComponent, ButtonComponent, DialogComponent } from '@faithtech-community/components';
import { Observable, firstValueFrom } from 'rxjs';

export interface ArchiveHubTemplateData {
  name: string;
  hubCount: number;
  archive: () => Observable<unknown>;
}

/**
 * Archive {name}? (L2-185 AC4), matching docs/mocks/dialogs/archive-hub-template: it leaves the hub wizard, and hubs
 * started from it keep what they have. Closes with true once archived; a failed archive offers Try again.
 */
@Component({
  selector: 'ft-archive-hub-template-dialog',
  imports: [AlertComponent, ButtonComponent, DialogComponent],
  templateUrl: './archive-hub-template.dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArchiveHubTemplateDialog {
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly data = inject<ArchiveHubTemplateData>(DIALOG_DATA);
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);

  protected readonly body = `Leads won’t be offered ${this.data.name} when they create a hub. ${
    this.data.hubCount === 0
      ? 'No hubs were started from it.'
      : this.data.hubCount === 1
        ? 'The hub started from it keeps what it has.'
        : `The ${this.data.hubCount} hubs started from it keep what they have.`
  } You can restore it from Archived.`;

  protected async archive(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.failed.set(false);
    try {
      await firstValueFrom(this.data.archive());
      this.ref.close(true);
    } catch {
      this.failed.set(true);
    } finally {
      this.busy.set(false);
    }
  }
}
