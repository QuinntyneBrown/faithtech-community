import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { AlertComponent } from '../alert/alert.component';
import { ButtonComponent } from '../button/button.component';
import { DialogComponent } from '../dialog/dialog.component';
import { ORGANISATION_NAMES } from '../organisation-names/organisation-names';

export interface ArchiveRoleDialogData {
  /** The role's name. */
  role: string;
  /** Archives: resolves to null on success or to the refusal to show; rejects when unreachable. */
  submit: () => Promise<string | null>;
}

/**
 * Archive {role}? (docs/design-system/components/archive-role-dialog, mocks dialogs/archive-role). A refusal (409)
 * replaces the confirmation and the footer offers only Close. Presentational (ADR 0005). Closes with true once
 * archived.
 */
@Component({
  selector: 'ft-archive-role-dialog',
  imports: [AlertComponent, ButtonComponent, DialogComponent],
  templateUrl: './archive-role-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArchiveRoleDialogComponent {
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly data = inject<ArchiveRoleDialogData>(DIALOG_DATA);
  protected readonly organisation = inject(ORGANISATION_NAMES);

  protected readonly busy = signal(false);
  protected readonly failed = signal(false);
  protected readonly refusal = signal('');

  protected async archive(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.failed.set(false);
    try {
      const refusal = await this.data.submit();
      if (refusal) this.refusal.set(refusal);
      else this.ref.close(true);
    } catch {
      this.failed.set(true);
    } finally {
      this.busy.set(false);
    }
  }
}
