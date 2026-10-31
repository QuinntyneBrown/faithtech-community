import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';

import { AlertComponent } from '../alert/alert.component';
import { ButtonComponent } from '../button/button.component';
import {
  CapabilityChecklistComponent,
  ChecklistEntry,
} from '../capability-checklist/capability-checklist.component';
import { DialogComponent } from '../dialog/dialog.component';
import { FormErrorFocusDirective } from '../form-error-focus/form-error-focus.directive';
import { FormFieldComponent } from '../form-field/form-field.component';
import { StackComponent } from '../layout/stack.component';
import { ORGANISATION_NAMES } from '../organisation-names/organisation-names';
import { SwitchComponent } from '../switch/switch.component';
import { TextFieldComponent } from '../text-field/text-field.component';
import { TextareaComponent } from '../textarea/textarea.component';

const MAX_NAME = 60;
const MAX_DESCRIPTION = 200;

/** What the dialog saves: a role's name, description, capabilities and options. */
export interface RoleDefinitionValue {
  name: string;
  description: string;
  capabilities: string[];
  showOnTeam: boolean;
  isOversight: boolean;
  /** "Can be held for a {chapter}" (L2-136 AC1). */
  chapterScopable: boolean;
}

/** Why a save was refused: a message for the whole form, or errors on its fields. */
export type DefineRoleRefusal =
  | { message: string }
  | { errors: Partial<Record<'name' | 'description' | 'capabilities', string>> };

export interface DefineRoleDialogData {
  mode: 'define' | 'edit';
  /** In edit mode, the role as it stands and how many members hold it. */
  role?: RoleDefinitionValue & { holderCount: number };
  /** The capability catalogue, in order. */
  capabilities: readonly ChecklistEntry[];
  /** The singular chapter label, e.g. "City"; null while chapters are off, which hides the chapter switch. */
  chapterLabel?: string | null;
  /** Saves: resolves to null on success or to a refusal to show; rejects when unreachable. */
  submit: (value: RoleDefinitionValue) => Promise<DefineRoleRefusal | null>;
}

/**
 * Define a role or edit one (docs/design-system/components/define-role-dialog, mocks dialogs/define-role): a name,
 * a description, the capability checklist and the options. Presentational (ADR 0005): the opener supplies the
 * catalogue and the call. Closes with the saved value. The "Can be held for a {chapter}" switch joins it with chapter
 * tags. Open it wide (`DialogService.open(..., { wide: true })`) for the two-column checklist.
 */
@Component({
  selector: 'ft-define-role-dialog',
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    ButtonComponent,
    CapabilityChecklistComponent,
    DialogComponent,
    FormErrorFocusDirective,
    FormFieldComponent,
    StackComponent,
    SwitchComponent,
    TextFieldComponent,
    TextareaComponent,
  ],
  templateUrl: './define-role-dialog.component.html',
  styleUrl: './define-role-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DefineRoleDialogComponent {
  protected readonly ref = inject<DialogRef<RoleDefinitionValue>>(DialogRef);
  protected readonly data = inject<DefineRoleDialogData>(DIALOG_DATA);
  protected readonly organisation = inject(ORGANISATION_NAMES);
  private readonly errorFocus = viewChild.required(FormErrorFocusDirective);

  protected readonly maxName = MAX_NAME;
  protected readonly maxDescription = MAX_DESCRIPTION;
  protected readonly editing = this.data.mode === 'edit';
  protected readonly heading = this.editing ? `Edit ${this.data.role?.name}` : 'Define a role';
  protected readonly description = this.editing
    ? `${holders(this.data.role?.holderCount ?? 0)} ${this.data.role?.name}. Changes apply on their next request.`
    : 'A role is a named set of capabilities. Members can hold several roles.';

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: [this.data.role?.name ?? ''],
    description: [this.data.role?.description ?? ''],
    capabilities: [[...(this.data.role?.capabilities ?? [])]],
    showOnTeam: [this.data.role?.showOnTeam ?? false],
    isOversight: [this.data.role?.isOversight ?? false],
    chapterScopable: [this.data.role?.chapterScopable ?? false],
  });
  protected readonly chapter = this.data.chapterLabel?.toLowerCase() ?? null;
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);
  protected readonly refusal = signal<string | null>(null);
  protected readonly nameError = signal('');
  protected readonly descriptionError = signal('');
  protected readonly capabilitiesError = signal('');

  protected async save(): Promise<void> {
    if (this.busy()) return;
    const raw = this.form.getRawValue();
    const value: RoleDefinitionValue = {
      ...raw,
      name: raw.name.trim(),
      description: raw.description.trim(),
    };
    this.nameError.set(
      !value.name
        ? 'Enter a name for the role.'
        : value.name.length > MAX_NAME
          ? `Use ${MAX_NAME} characters or fewer for the name.`
          : '',
    );
    this.descriptionError.set(
      value.description.length > MAX_DESCRIPTION
        ? `Use ${MAX_DESCRIPTION} characters or fewer for the description.`
        : '',
    );
    this.capabilitiesError.set('');
    if (this.nameError() || this.descriptionError()) {
      this.errorFocus().focusFirstError();
      return;
    }

    this.busy.set(true);
    this.failed.set(false);
    this.refusal.set(null);
    try {
      const refusal = await this.data.submit(value);
      if (!refusal) {
        this.ref.close(value);
      } else if ('message' in refusal) {
        this.refusal.set(refusal.message);
      } else {
        this.nameError.set(refusal.errors.name ?? '');
        this.descriptionError.set(refusal.errors.description ?? '');
        this.capabilitiesError.set(refusal.errors.capabilities ?? '');
        this.errorFocus().focusFirstError();
      }
    } catch {
      this.failed.set(true);
    } finally {
      this.busy.set(false);
    }
  }
}

function holders(count: number): string {
  return count === 1 ? '1 member holds' : `${count} members hold`;
}
