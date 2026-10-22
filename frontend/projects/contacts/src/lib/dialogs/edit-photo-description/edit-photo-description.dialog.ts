import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { CONTACTS_SERVICE } from '@faithtech-community/api';
import {
  AlertComponent,
  ButtonComponent,
  DialogComponent,
  FormFieldComponent,
  PhotoComponent,
  StackComponent,
  TextFieldComponent,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

/** The contact photo a dialog acts on; `url` is already loadable by the browser. */
export interface PhotoRef {
  contactId: string;
  contactName: string;
  photo: { id: string; url: string | null; altText: string; featured: boolean };
}

// Mirrors the server's description rule (L2-069).
const MAX_ALT = 300;

/**
 * Changes a contact photo's description (L2-068 AC4), matching docs/mocks/dialogs/edit-photo-description.
 * Closes with the saved description.
 */
@Component({
  selector: 'ft-edit-photo-description-dialog',
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    ButtonComponent,
    DialogComponent,
    FormFieldComponent,
    PhotoComponent,
    StackComponent,
    TextFieldComponent,
  ],
  templateUrl: './edit-photo-description.dialog.html',
  styleUrl: './edit-photo-description.dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditPhotoDescriptionDialog {
  protected readonly ref = inject<DialogRef<string>>(DialogRef);
  protected readonly data = inject<PhotoRef>(DIALOG_DATA);
  private readonly contacts = inject(CONTACTS_SERVICE);

  protected readonly altText = new FormControl(this.data.photo.altText, { nonNullable: true });
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);
  protected readonly error = signal('');

  protected async save(): Promise<void> {
    if (this.busy()) return;
    const altText = this.altText.value.trim();
    this.error.set(
      !altText
        ? 'Describe this photo.'
        : altText.length > MAX_ALT
          ? `Use ${MAX_ALT} characters or fewer to describe this photo.`
          : '',
    );
    if (this.error()) return;

    this.busy.set(true);
    this.failed.set(false);
    try {
      await firstValueFrom(
        this.contacts.describePhoto(this.data.contactId, this.data.photo.id, altText),
      );
      this.ref.close(altText);
    } catch {
      this.failed.set(true);
    } finally {
      this.busy.set(false);
    }
  }
}
