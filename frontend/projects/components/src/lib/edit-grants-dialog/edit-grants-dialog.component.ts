import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { AlertComponent } from '../alert/alert.component';
import { ButtonComponent } from '../button/button.component';
import {
  CapabilityChecklistComponent,
  ChecklistEntry,
} from '../capability-checklist/capability-checklist.component';
import { DialogComponent } from '../dialog/dialog.component';
import { StackComponent } from '../layout/stack.component';
import { ORGANISATION_NAMES } from '../organisation-names/organisation-names';

export interface EditGrantsDialogData {
  /** The grantor role's name. */
  grantor: string;
  /** Whether the grantor carries Assign roles; without it the rules are stored but inactive. */
  canAssign: boolean;
  /** Every other active role; an administration role the grantor may not grant carries a disabledReason. */
  roles: readonly ChecklistEntry[];
  /** The roles its rules grant today. */
  granted: readonly string[];
  /** Saves: resolves to null on success or to a refusal to show; rejects when unreachable. */
  submit: (grantable: string[]) => Promise<string | null>;
}

/**
 * Who may grant (docs/design-system/components/edit-grants-dialog, mocks dialogs/edit-grants): one checkbox per
 * active role under "Holders of {role} may add and remove:". Presentational (ADR 0005): the opener supplies the roles
 * and the call. Closes with the saved role values.
 */
@Component({
  selector: 'ft-edit-grants-dialog',
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    ButtonComponent,
    CapabilityChecklistComponent,
    DialogComponent,
    StackComponent,
  ],
  templateUrl: './edit-grants-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditGrantsDialogComponent {
  protected readonly ref = inject<DialogRef<string[]>>(DialogRef);
  protected readonly data = inject<EditGrantsDialogData>(DIALOG_DATA);
  protected readonly organisation = inject(ORGANISATION_NAMES);

  protected readonly granted = new FormControl<string[]>([...this.data.granted], {
    nonNullable: true,
  });
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);
  protected readonly refusal = signal('');

  protected async save(): Promise<void> {
    if (this.busy()) return;
    const order = this.data.roles.map((r) => r.value);
    const value = [...this.granted.value].sort((a, b) => order.indexOf(a) - order.indexOf(b));
    this.busy.set(true);
    this.granted.disable();
    this.failed.set(false);
    this.refusal.set('');
    try {
      const refusal = await this.data.submit(value);
      if (refusal) this.refusal.set(refusal);
      else this.ref.close(value);
    } catch {
      this.failed.set(true);
    } finally {
      this.busy.set(false);
      this.granted.enable();
    }
  }
}
