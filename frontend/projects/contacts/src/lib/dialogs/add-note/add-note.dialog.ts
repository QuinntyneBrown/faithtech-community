import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { CONTACTS_SERVICE, ContactNoteDto } from '@faithtech-community/api';
import {
  AlertComponent,
  ButtonComponent,
  DialogComponent,
  FormFieldComponent,
  StackComponent,
  TextareaComponent,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

export interface AddNoteData {
  contactId: string;
  contactName: string;
}

// Mirrors the server's note rule (ADR 0013).
const MAX_NOTE = 2000;

/**
 * Adds a private note to a contact (L2-014), matching docs/mocks/dialogs/add-note.
 * Closes with the saved note.
 */
@Component({
  selector: 'ft-add-note-dialog',
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    ButtonComponent,
    DialogComponent,
    FormFieldComponent,
    StackComponent,
    TextareaComponent,
  ],
  templateUrl: './add-note.dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddNoteDialog {
  protected readonly ref = inject<DialogRef<ContactNoteDto>>(DialogRef);
  protected readonly data = inject<AddNoteData>(DIALOG_DATA);
  private readonly contacts = inject(CONTACTS_SERVICE);

  protected readonly body = new FormControl('', { nonNullable: true });
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);
  protected readonly error = signal('');

  protected async add(): Promise<void> {
    if (this.busy()) return;
    const body = this.body.value.trim();
    this.error.set(
      !body
        ? 'Write a note to save.'
        : body.length > MAX_NOTE
          ? 'Use 2,000 characters or fewer for the note.'
          : '',
    );
    if (this.error()) return;

    this.busy.set(true);
    this.failed.set(false);
    try {
      this.ref.close(await firstValueFrom(this.contacts.addNote(this.data.contactId, body)));
    } catch {
      this.failed.set(true);
    } finally {
      this.busy.set(false);
    }
  }
}
