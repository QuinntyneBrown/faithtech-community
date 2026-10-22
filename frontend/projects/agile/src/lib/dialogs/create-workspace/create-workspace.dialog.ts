import { DialogRef } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import {
  AGILE_SERVICE,
  MemberCandidateDto,
  ROLE_LABELS,
  WorkspaceDto,
  WorkspaceMethod,
  problemDetails,
} from '@faithtech-community/api';
import {
  AlertComponent,
  ButtonComponent,
  CheckboxComponent,
  CheckboxGroupComponent,
  DialogComponent,
  FormErrorFocusDirective,
  FormFieldComponent,
  RadioComponent,
  RadioGroupComponent,
  StackComponent,
  TextFieldComponent,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

/**
 * New workspace: a name, Scrum or Kanban, and members from the leads and volunteers (L2-031 AC1, AC2),
 * matching docs/mocks/dialogs/create-workspace. Closes with the created workspace.
 */
@Component({
  selector: 'ft-create-workspace-dialog',
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    ButtonComponent,
    CheckboxComponent,
    CheckboxGroupComponent,
    DialogComponent,
    FormErrorFocusDirective,
    FormFieldComponent,
    RadioComponent,
    RadioGroupComponent,
    StackComponent,
    TextFieldComponent,
  ],
  templateUrl: './create-workspace.dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateWorkspaceDialog {
  protected readonly ref = inject<DialogRef<WorkspaceDto>>(DialogRef);
  private readonly agile = inject(AGILE_SERVICE);
  private readonly errorFocus = viewChild.required(FormErrorFocusDirective);

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: [''],
    method: ['Scrum' as WorkspaceMethod],
    memberIds: [[] as string[]],
  });
  protected readonly candidates = signal<MemberCandidateDto[]>([]);
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);
  protected readonly nameError = signal('');
  protected readonly membersError = signal('');

  constructor() {
    void this.loadCandidates();
  }

  protected roles(candidate: MemberCandidateDto): string {
    return candidate.roles.map((r) => ROLE_LABELS[r]).join(', ');
  }

  protected async create(): Promise<void> {
    if (this.busy()) return;
    const { name, method, memberIds } = this.form.getRawValue();
    this.nameError.set(name.trim() ? '' : 'Give the workspace a name.');
    this.membersError.set('');
    if (this.nameError()) {
      this.errorFocus().focusFirstError();
      return;
    }

    this.busy.set(true);
    this.failed.set(false);
    try {
      const workspace = await firstValueFrom(
        this.agile.createWorkspace({ name: name.trim(), method, memberIds }),
      );
      this.ref.close(workspace);
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 400) {
        const errors = problemDetails(error)?.errors;
        this.nameError.set(errors?.['Name']?.[0] ?? '');
        this.membersError.set(errors?.['MemberIds']?.[0] ?? '');
        this.errorFocus().focusFirstError();
      } else {
        this.failed.set(true);
      }
    } finally {
      this.busy.set(false);
    }
  }

  private async loadCandidates(): Promise<void> {
    try {
      this.candidates.set(await firstValueFrom(this.agile.listMemberCandidates()));
    } catch {
      this.candidates.set([]);
    }
  }
}
