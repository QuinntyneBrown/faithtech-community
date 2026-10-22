import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { AGILE_SERVICE, WorkItemStatus } from '@faithtech-community/api';
import {
  AlertComponent,
  ButtonComponent,
  DialogComponent,
  RadioComponent,
  RadioGroupComponent,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

import { STATUS_LABELS } from '../../work-item-labels';

export interface MoveCardData {
  itemId: string;
  title: string;
  status: WorkItemStatus;
}

/**
 * The keyboard path for moving a card (L2-034 AC2), matching docs/mocks/dialogs/move-card. Closes with
 * the new status once the move is saved.
 */
@Component({
  selector: 'ft-move-card-dialog',
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    ButtonComponent,
    DialogComponent,
    RadioComponent,
    RadioGroupComponent,
  ],
  templateUrl: './move-card.dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MoveCardDialog {
  protected readonly ref = inject<DialogRef<WorkItemStatus>>(DialogRef);
  protected readonly data = inject<MoveCardData>(DIALOG_DATA);
  private readonly agile = inject(AGILE_SERVICE);

  protected readonly labels = STATUS_LABELS;
  protected readonly statuses = Object.keys(STATUS_LABELS) as WorkItemStatus[];
  protected readonly status = new FormControl<WorkItemStatus>(this.data.status, {
    nonNullable: true,
  });
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);

  protected async move(): Promise<void> {
    if (this.busy()) return;
    const status = this.status.value;
    if (status === this.data.status) {
      this.ref.close();
      return;
    }
    this.busy.set(true);
    this.failed.set(false);
    try {
      await firstValueFrom(this.agile.moveCard(this.data.itemId, status));
      this.ref.close(status);
    } catch {
      this.failed.set(true);
    } finally {
      this.busy.set(false);
    }
  }
}
