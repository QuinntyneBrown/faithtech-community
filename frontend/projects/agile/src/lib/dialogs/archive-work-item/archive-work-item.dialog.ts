import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AGILE_SERVICE, OrganisationNames, WorkItemDto } from '@faithtech-community/api';
import { AlertComponent, ButtonComponent, DialogComponent } from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

export interface ArchiveWorkItemData {
  item: WorkItemDto;
}

/**
 * Confirms archiving a work item and everything under it, such as a story's tasks (L2-037 AC1), matching
 * docs/mocks/dialogs/archive-work-item. Closes with true once archived.
 */
@Component({
  selector: 'ft-archive-work-item-dialog',
  imports: [AlertComponent, ButtonComponent, DialogComponent],
  templateUrl: './archive-work-item.dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArchiveWorkItemDialog {
  protected readonly organisation = inject(OrganisationNames);
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly data = inject<ArchiveWorkItemData>(DIALOG_DATA);
  private readonly agile = inject(AGILE_SERVICE);

  protected readonly busy = signal(false);
  protected readonly failed = signal(false);

  /** "Its 3 tasks are archived with it. The owner can restore it from workspace settings." */
  protected readonly description = (() => {
    const tasks = this.data.item.tasks.length;
    const restore = 'The owner can restore it from workspace settings.';
    if (!tasks) return restore;
    return tasks === 1
      ? `Its 1 task is archived with it. ${restore}`
      : `Its ${tasks} tasks are archived with it. ${restore}`;
  })();

  protected async archive(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.failed.set(false);
    try {
      await firstValueFrom(this.agile.archiveWorkItem(this.data.item.id));
      this.ref.close(true);
    } catch {
      this.failed.set(true);
    } finally {
      this.busy.set(false);
    }
  }
}
