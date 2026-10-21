import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { AGILE_SERVICE, WorkspaceDto, problemDetails } from '@faithtech-community/api';
import {
  AlertComponent,
  ButtonComponent,
  DialogComponent,
  FormErrorFocusDirective,
  FormFieldComponent,
  SelectComponent,
  SelectOption,
  StackComponent,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

export interface ReassignOwnerData {
  workspace: WorkspaceDto;
}

/**
 * System Admin gives a workspace to another City Lead after its owner lost the role (L2-037 AC2), matching
 * docs/mocks/dialogs/reassign-owner. The change is audited. Closes with the new owner's name.
 */
@Component({
  selector: 'ft-reassign-owner-dialog',
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    ButtonComponent,
    DialogComponent,
    FormErrorFocusDirective,
    FormFieldComponent,
    SelectComponent,
    StackComponent,
  ],
  templateUrl: './reassign-owner.dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReassignOwnerDialog implements OnInit {
  protected readonly ref = inject<DialogRef<string>>(DialogRef);
  protected readonly data = inject<ReassignOwnerData>(DIALOG_DATA);
  private readonly agile = inject(AGILE_SERVICE);
  private readonly errorFocus = viewChild.required(FormErrorFocusDirective);

  protected readonly owner = new FormControl('', { nonNullable: true });
  protected readonly options = signal<SelectOption[]>([]);
  protected readonly ownerError = signal('');
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);

  protected readonly description =
    `${this.data.workspace.ownerName} no longer holds the City Lead role, and a workspace owner must be a ` +
    'City Lead. This is recorded in the audit log.';

  async ngOnInit(): Promise<void> {
    try {
      const leads = await firstValueFrom(this.agile.listOwnerCandidates(this.data.workspace.id));
      this.options.set(leads.map((l) => ({ value: l.profileId, label: l.name })));
    } catch {
      this.failed.set(true);
    }
  }

  protected async reassign(): Promise<void> {
    if (this.busy()) return;
    const ownerId = this.owner.value;
    this.ownerError.set(ownerId ? '' : 'Choose who will own this workspace.');
    if (this.ownerError()) {
      this.errorFocus().focusFirstError();
      return;
    }
    this.busy.set(true);
    this.failed.set(false);
    try {
      await firstValueFrom(this.agile.reassignOwner(this.data.workspace.id, ownerId));
      this.ref.close(this.options().find((o) => o.value === ownerId)?.label ?? '');
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 400) {
        this.ownerError.set(
          problemDetails(error)?.errors?.['OwnerId']?.[0] ?? 'Choose a City Lead.',
        );
        this.errorFocus().focusFirstError();
      } else {
        this.failed.set(true);
      }
    } finally {
      this.busy.set(false);
    }
  }
}
