import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { EVENT_HUBS_SERVICE, HubSectionKind } from '@faithtech-community/api';
import {
  AlertComponent,
  ButtonComponent,
  DialogComponent,
  ReorderableItem,
  ReorderableListComponent,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

export interface ReorderHubSectionsData {
  eventId: string;
  /** The sections in their current order: kind, title and the row's state badge. */
  sections: readonly ReorderableItem[];
}

/**
 * Reorder sections (L2-156 AC4, AC6), matching docs/mocks/dialogs/reorder-hub-sections: every section by drag or by
 * Move up and Move down, each move announced. Save stores the whole order; a failure keeps the order on screen with
 * Try again. Closes with true once saved.
 */
@Component({
  selector: 'ft-reorder-hub-sections-dialog',
  imports: [AlertComponent, ButtonComponent, DialogComponent, ReorderableListComponent],
  templateUrl: './reorder-hub-sections.dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReorderHubSectionsDialog {
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  private readonly data = inject<ReorderHubSectionsData>(DIALOG_DATA);
  private readonly hubs = inject(EVENT_HUBS_SERVICE);

  protected readonly items = signal<readonly ReorderableItem[]>(this.data.sections);
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);

  protected reordered(ids: string[]): void {
    this.items.set(ids.map((id) => this.items().find((i) => i.id === id)!));
  }

  protected async save(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.failed.set(false);
    try {
      const kinds = this.items().map((i) => i.id as HubSectionKind);
      await firstValueFrom(this.hubs.reorder(this.data.eventId, kinds));
      this.ref.close(true);
    } catch {
      this.failed.set(true);
    } finally {
      this.busy.set(false);
    }
  }
}
