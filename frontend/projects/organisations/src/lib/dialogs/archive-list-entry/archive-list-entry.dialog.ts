import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { OrganisationNames, problemDetails } from '@faithtech-community/api';
import {
  AlertComponent,
  ButtonComponent,
  DialogComponent,
  LinkComponent,
} from '@faithtech-community/components';
import { Observable, firstValueFrom } from 'rxjs';

export interface ArchiveListEntryData {
  name: string;
  description: string;
  /** What archiving does to the records that use it. */
  body: string;
  /** The primary action's label, such as "Archive stage". */
  archiveLabel: string;
  /** A reason known up front, such as the partners on a stage; the dialog then only explains it. */
  refusal?: string | null;
  /** Where the records that block it can be moved, shown with a refusal. */
  fix?: { href: string; label: string };
  archive: () => Observable<unknown>;
}

/**
 * Archive {name}? for an entry of one of the organisation's lists (L2-144 AC7), matching
 * docs/mocks/dialogs/archive-list-entry: a refusal (409, or one known up front) shows "Can’t archive {name}" with the
 * reason and where to fix it. Closes with true once archived.
 */
@Component({
  selector: 'ft-archive-list-entry-dialog',
  imports: [AlertComponent, ButtonComponent, DialogComponent, LinkComponent],
  templateUrl: './archive-list-entry.dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArchiveListEntryDialog {
  protected readonly names = inject(OrganisationNames);
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly data = inject<ArchiveListEntryData>(DIALOG_DATA);

  protected readonly busy = signal(false);
  protected readonly failed = signal(false);
  protected readonly refusal = signal(this.data.refusal ?? null);

  protected async archive(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.failed.set(false);
    try {
      await firstValueFrom(this.data.archive());
      this.ref.close(true);
    } catch (error) {
      const detail =
        error instanceof HttpErrorResponse && error.status === 409
          ? problemDetails(error)?.detail
          : undefined;
      if (detail) this.refusal.set(detail);
      else this.failed.set(true);
    } finally {
      this.busy.set(false);
    }
  }
}
