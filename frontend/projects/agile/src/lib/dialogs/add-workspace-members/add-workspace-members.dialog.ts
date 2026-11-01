import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  AGILE_SERVICE,
  MemberCandidateDto,
  OrganisationNames,
  problemDetails,
  WorkspaceDto,
  OrganisationRoles,
} from '@faithtech-community/api';
import {
  AlertComponent,
  ButtonComponent,
  CheckboxComponent,
  CheckboxGroupComponent,
  DialogComponent,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

/**
 * Add members to a workspace from the leads and volunteers not in it yet (L2-031 AC2), matching
 * docs/mocks/dialogs/add-workspace-member. Closes with the names of the people added.
 */
@Component({
  selector: 'ft-add-workspace-members-dialog',
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    ButtonComponent,
    CheckboxComponent,
    CheckboxGroupComponent,
    DialogComponent,
  ],
  templateUrl: './add-workspace-members.dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddWorkspaceMembersDialog {
  private readonly organisationRoles = inject(OrganisationRoles);
  protected readonly organisation = inject(OrganisationNames);
  protected readonly ref = inject<DialogRef<string[]>>(DialogRef);
  protected readonly workspace = inject<WorkspaceDto>(DIALOG_DATA);
  private readonly agile = inject(AGILE_SERVICE);

  protected readonly chosen = new FormControl<string[]>([], { nonNullable: true });
  protected readonly candidates = signal<MemberCandidateDto[] | null>(null);
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);
  protected readonly error = signal('');

  constructor() {
    void this.loadCandidates();
  }

  protected roles(candidate: MemberCandidateDto): string {
    return candidate.roles.map((r) => this.organisationRoles.label(r)).join(', ');
  }

  protected async add(): Promise<void> {
    if (this.busy()) return;
    const ids = this.chosen.value;
    this.error.set(ids.length ? '' : 'Choose at least one person.');
    if (this.error()) return;
    this.busy.set(true);
    this.failed.set(false);
    try {
      await firstValueFrom(this.agile.addMembers(this.workspace.id, ids));
      const names = (this.candidates() ?? [])
        .filter((c) => ids.includes(c.profileId))
        .map((c) => c.name);
      this.ref.close(names);
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 400) {
        this.error.set(
          problemDetails(error)?.errors?.['ProfileIds']?.[0] ?? 'Check who you chose.',
        );
      } else {
        this.failed.set(true);
      }
    } finally {
      this.busy.set(false);
    }
  }

  private async loadCandidates(): Promise<void> {
    try {
      this.candidates.set(await firstValueFrom(this.agile.listMemberCandidates(this.workspace.id)));
    } catch {
      this.candidates.set([]);
      this.failed.set(true);
    }
  }
}
