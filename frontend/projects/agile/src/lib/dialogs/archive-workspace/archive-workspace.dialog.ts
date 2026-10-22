import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AGILE_SERVICE, WorkspaceDto } from '@faithtech-community/api';
import { AlertComponent, ButtonComponent, DialogComponent } from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

export interface ArchiveWorkspaceData {
  workspace: WorkspaceDto;
}

/**
 * Confirms archiving a workspace, which members lose until it is restored (L2-037 AC1), matching
 * docs/mocks/dialogs/archive-workspace. Closes with true once archived.
 */
@Component({
  selector: 'ft-archive-workspace-dialog',
  imports: [AlertComponent, ButtonComponent, DialogComponent],
  templateUrl: './archive-workspace.dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArchiveWorkspaceDialog {
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly data = inject<ArchiveWorkspaceData>(DIALOG_DATA);
  private readonly agile = inject(AGILE_SERVICE);

  protected readonly busy = signal(false);
  protected readonly failed = signal(false);

  protected async archive(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.failed.set(false);
    try {
      await firstValueFrom(this.agile.archiveWorkspace(this.data.workspace.id));
      this.ref.close(true);
    } catch {
      this.failed.set(true);
    } finally {
      this.busy.set(false);
    }
  }
}
