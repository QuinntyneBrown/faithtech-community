import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NOTES_SERVICE } from '@faithtech-community/api';
import { AlertComponent, ButtonComponent, DialogComponent } from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

/**
 * Confirms archiving a page (L2-095 AC1, AC7), as in docs/mocks/dialogs/archive-note. Focus starts on Cancel;
 * closes with true once archived.
 */
@Component({
  selector: 'ft-archive-note-dialog',
  imports: [AlertComponent, ButtonComponent, DialogComponent],
  templateUrl: './archive-note.dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArchiveNoteDialog {
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
      await firstValueFrom(this.notes.archive(this.page.id));
      this.ref.close(true);
    } catch {
      this.failed.set(true);
    } finally {
      this.busy.set(false);
    }
  }
}
