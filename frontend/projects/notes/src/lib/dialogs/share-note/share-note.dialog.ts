import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import {
  NOTE_SHAREABLE_ROLES,
  NotePageDto,
  NOTES_SERVICE,
  NoteVisibility,
  OrganisationNames,
  Role,
  ROLE_LABELS,
} from '@faithtech-community/api';
import {
  AlertComponent,
  ButtonComponent,
  CheckboxComponent,
  CheckboxGroupComponent,
  DialogComponent,
  FormFieldComponent,
  PersonOption,
  PersonPickerComponent,
  RadioComponent,
  RadioGroupComponent,
} from '@faithtech-community/components';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';

import { titleOf } from '../../note-format';

const AUDIENCE_MESSAGE = 'Choose at least one person or role, or pick another visibility.';

/** "Share {title}" (L2-093 AC1-AC4, AC9), as in docs/mocks/dialogs/share-note. Closes with the shared page. */
@Component({
  selector: 'ft-share-note-dialog',
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    ButtonComponent,
    CheckboxComponent,
    CheckboxGroupComponent,
    DialogComponent,
    FormFieldComponent,
    PersonPickerComponent,
    RadioComponent,
    RadioGroupComponent,
  ],
  templateUrl: './share-note.dialog.html',
  styleUrl: './share-note.dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShareNoteDialog {
  protected readonly organisation = inject(OrganisationNames);
  protected readonly ref = inject<DialogRef<NotePageDto>>(DialogRef);
  protected readonly page = inject<NotePageDto>(DIALOG_DATA);
  private readonly notes = inject(NOTES_SERVICE);

  protected readonly title = titleOf(this.page);
  protected readonly roles = NOTE_SHAREABLE_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }));
  protected readonly form = new FormGroup({
    visibility: new FormControl<NoteVisibility>(this.page.visibility, { nonNullable: true }),
    members: new FormControl<PersonOption[]>(
      this.page.audience.members.map((m) => ({ id: m.id, name: m.name, detail: m.city ?? '' })),
      { nonNullable: true },
    ),
    roles: new FormControl<Role[]>(
      this.page.audience.roles.map((r) => r.role),
      { nonNullable: true },
    ),
  });
  protected readonly visibility = toSignal(this.form.controls.visibility.valueChanges, {
    initialValue: this.form.controls.visibility.value,
  });
  protected readonly people = signal<PersonOption[]>([]);
  protected readonly searching = signal(false);
  protected readonly error = signal('');
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);

  protected async searchPeople(q: string): Promise<void> {
    if (!q) {
      this.people.set([]);
      return;
    }
    this.searching.set(true);
    try {
      const members = await firstValueFrom(this.notes.members(q));
      this.people.set(
        members.map((m) => ({
          id: m.id,
          name: m.name,
          detail: [m.roles.map((r) => ROLE_LABELS[r]).join(', '), m.city]
            .filter(Boolean)
            .join(' · '),
        })),
      );
    } catch {
      this.people.set([]);
    } finally {
      this.searching.set(false);
    }
  }

  protected async save(): Promise<void> {
    if (this.busy()) return;
    const { visibility, members, roles } = this.form.getRawValue();
    if (visibility === 'Shared' && members.length === 0 && roles.length === 0) {
      this.error.set(AUDIENCE_MESSAGE);
      return;
    }
    this.error.set('');
    this.busy.set(true);
    this.failed.set(false);
    try {
      const shared = await firstValueFrom(
        this.notes.setVisibility(this.page.id, {
          visibility,
          memberIds: visibility === 'Shared' ? members.map((m) => m.id) : [],
          roles: visibility === 'Shared' ? roles : [],
        }),
      );
      this.ref.close(shared);
    } catch {
      this.failed.set(true);
    } finally {
      this.busy.set(false);
    }
  }
}
