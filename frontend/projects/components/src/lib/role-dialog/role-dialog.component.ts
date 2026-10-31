import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { AlertComponent } from '../alert/alert.component';
import { ORGANISATION_NAMES } from '../organisation-names/organisation-names';
import { ButtonComponent } from '../button/button.component';
import { DialogComponent } from '../dialog/dialog.component';
import { FormFieldComponent } from '../form-field/form-field.component';
import { SelectComponent, SelectOption } from '../select/select.component';
import { RadioGroupComponent } from '../radio-group/radio-group.component';
import { RadioComponent } from '../radio-group/radio.component';
import { StackComponent } from '../layout/stack.component';

export interface RoleOption {
  value: string;
  label: string;
  description?: string;
}

/**
 * The chapter picker an added chapter-scopable role offers (L2-143): shown only for the roles in `roleIds`. A
 * required picker offers just `options`; an optional one offers "No {chapter}" first.
 */
export interface RoleChapterPicker {
  /** The organisation's chapter label, e.g. "City". */
  label: string;
  /** The chapter-scopable roles: the picker shows when one of them is chosen. */
  roleIds: readonly string[];
  /** The chapters offered, in order. */
  options: SelectOption[];
  /** A scoped grantor must tag the role with one of their chapters. */
  required: boolean;
  /** The help under the picker, for the chosen role's label. */
  help: (roleLabel: string) => string;
}

export interface RoleDialogData {
  mode: 'add' | 'remove';
  /** The person whose roles change. */
  name: string;
  description: string;
  options: RoleOption[];
  /** Small print under the options, e.g. which roles only a System Admin grants. */
  caption?: string;
  /** In add mode, the chapter picker for chapter-scopable roles; absent while chapters are off. */
  chapter?: RoleChapterPicker;
  /**
   * Makes the change with the chosen option and, for a role the picker shows for, the chosen chapter (null for none):
   * resolves to null on success or to a message to show; rejects when unreachable.
   */
  submit: (value: string, chapterId: string | null) => Promise<string | null>;
}

/**
 * Add or remove one role, matching docs/mocks/dialogs/add-role and remove-role (ADR 0005).
 * Presentational: the opener supplies the options and the call. Closes with the chosen role.
 */
@Component({
  selector: 'ft-role-dialog',
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    ButtonComponent,
    DialogComponent,
    FormFieldComponent,
    RadioGroupComponent,
    RadioComponent,
    SelectComponent,
    StackComponent,
  ],
  templateUrl: './role-dialog.component.html',
  styleUrl: './role-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoleDialogComponent {
  protected readonly ref = inject<DialogRef<string>>(DialogRef);
  protected readonly data = inject<RoleDialogData>(DIALOG_DATA);
  protected readonly organisation = inject(ORGANISATION_NAMES);

  protected readonly adding = this.data.mode === 'add';
  /** One role to remove is no choice: the title names it and no radio group is shown. */
  protected readonly choosing = this.adding || this.data.options.length > 1;
  protected readonly role = new FormControl<string | null>(
    this.adding ? null : (this.data.options[0]?.value ?? null),
  );
  private readonly chosen = toSignal(this.role.valueChanges, { initialValue: this.role.value });

  protected readonly picker = this.adding ? this.data.chapter : undefined;
  protected readonly chapterOptions: SelectOption[] = this.picker
    ? this.picker.required
      ? this.picker.options
      : [{ value: '', label: `No ${this.picker.label.toLowerCase()}` }, ...this.picker.options]
    : [];
  protected readonly chapter = new FormControl<string>(this.chapterOptions[0]?.value ?? '', {
    nonNullable: true,
  });
  /** The picker shows for a chosen chapter-scopable role. */
  protected readonly showChapter = computed(() => {
    const role = this.chosen();
    return !!this.picker && !!role && this.picker.roleIds.includes(role);
  });
  protected readonly chapterHelp = computed(() => {
    const label = this.data.options.find((o) => o.value === this.chosen())?.label ?? '';
    return this.picker?.help(label) ?? '';
  });

  protected readonly busy = signal(false);
  protected readonly submitted = signal(false);
  protected readonly refusal = signal<string | null>(null);
  protected readonly failed = signal(false);

  protected readonly heading = computed(() => {
    if (this.adding) return `Add a role for ${this.data.name}`;
    const label = this.data.options.find((o) => o.value === this.chosen())?.label ?? 'a role';
    return `Remove ${label} from ${this.data.name}?`;
  });
  protected readonly error = computed(() =>
    this.submitted() && !this.chosen() ? 'Choose a role to add.' : '',
  );
  protected readonly confirmLabel = computed(() => {
    if (this.busy()) return this.adding ? 'Adding role…' : 'Removing role…';
    return this.adding ? 'Add role' : 'Remove role';
  });

  protected async confirm(): Promise<void> {
    this.submitted.set(true);
    const value = this.role.value;
    if (!value || this.busy()) return;
    this.busy.set(true);
    this.refusal.set(null);
    this.failed.set(false);
    try {
      const chapterId = this.showChapter() ? this.chapter.value || null : null;
      const refusal = await this.data.submit(value, chapterId);
      if (refusal) this.refusal.set(refusal);
      else this.ref.close(value);
    } catch {
      this.failed.set(true);
    } finally {
      this.busy.set(false);
    }
  }
}
