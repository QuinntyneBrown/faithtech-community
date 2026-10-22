import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NOTES_SERVICE } from '@faithtech-community/api';
import { AlertComponent, ButtonComponent, DialogComponent } from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

/**
 * Confirms restoring an archived page (L2-095 AC4), as in docs/mocks/dialogs/restore-note;
 * closes with true once restored.
 */
@Component({
  selector: 'ft-restore-note-dialog',
  imports: [AlertComponent, ButtonComponent, DialogComponent],
  templateUrl: './restore-note.dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RestoreNoteDialog {
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly page = inject<{ id: string; title: string }>(DIALOG_DATA);
  private readonly notes = inject(NOTES_SERVICE);

  protected readonly busy = signal(false);
  protected readonly failed = signal(false);

  protected async confirm(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.failed.set(false);
    try {
      await firstValueFrom(this.notes.restore(this.page.id));
      this.ref.close(true);
    } catch {
      this.failed.set(true);
    } finally {
      this.busy.set(false);
    }
  }
}
