import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  AGILE_SERVICE,
  BoardCardDto,
  BoardSprintDto,
  WorkItemStatus,
} from '@faithtech-community/api';
import {
  AlertComponent,
  BadgeComponent,
  ButtonComponent,
  CardComponent,
  DialogComponent,
  ListComponent,
  ListItemComponent,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

import { STATUS_LABELS } from '../../work-item-labels';

export interface CloseSprintData {
  workspaceId: string;
  sprint: BoardSprintDto;
  /** The sprint's stories that are not Done, with their column. */
  unfinished: { card: BoardCardDto; status: WorkItemStatus }[];
}

/**
 * Close the active sprint (L2-035 AC3): says what it completed and which stories go back to the backlog,
 * matching docs/mocks/dialogs/close-sprint. Closes with true once the sprint is closed.
 */
@Component({
  selector: 'ft-close-sprint-dialog',
  imports: [
    AlertComponent,
    BadgeComponent,
    ButtonComponent,
    CardComponent,
    DialogComponent,
    ListComponent,
    ListItemComponent,
  ],
  templateUrl: './close-sprint.dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CloseSprintDialog {
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly data = inject<CloseSprintData>(DIALOG_DATA);
  private readonly agile = inject(AGILE_SERVICE);

  protected readonly labels = STATUS_LABELS;
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);

  /** "6 of 24 points completed. 4 unfinished stories go back to the backlog and keep their status." */
  protected readonly description = (() => {
    const { sprint, unfinished } = this.data;
    const done = `${sprint.completedPoints} of ${sprint.totalPoints} points completed.`;
    const n = unfinished.length;
    if (n === 0) return `${done} Every story is done.`;
    const stories = n === 1 ? '1 unfinished story goes' : `${n} unfinished stories go`;
    return `${done} ${stories} back to the backlog and keep their status.`;
  })();

  protected async close(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.failed.set(false);
    try {
      await firstValueFrom(this.agile.closeSprint(this.data.workspaceId, this.data.sprint.id));
      this.ref.close(true);
    } catch {
      this.failed.set(true);
    } finally {
      this.busy.set(false);
    }
  }
}
