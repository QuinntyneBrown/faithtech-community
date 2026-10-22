import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CONTACTS_SERVICE } from '@faithtech-community/api';
import {
  AlertComponent,
  ButtonComponent,
  DialogComponent,
  PhotoComponent,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

import { PhotoRef } from '../edit-photo-description';

/**
 * Confirms deleting a contact photo (L2-056 AC5, AC6), matching docs/mocks/dialogs/delete-contact-photo.
 * Closes with true once the photo is deleted.
 */
@Component({
  selector: 'ft-delete-contact-photo-dialog',
  imports: [AlertComponent, ButtonComponent, DialogComponent, PhotoComponent],
  templateUrl: './delete-contact-photo.dialog.html',
  styleUrl: './delete-contact-photo.dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeleteContactPhotoDialog {
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly data = inject<PhotoRef>(DIALOG_DATA);
  private readonly contacts = inject(CONTACTS_SERVICE);

  protected readonly busy = signal(false);
  protected readonly failed = signal(false);
  protected readonly description = this.data.photo.featured
    ? `“${this.data.photo.altText}” is the featured photo. Their newest remaining photo becomes featured. This can’t be undone.`
    : `“${this.data.photo.altText}” will be removed from ${this.data.contactName}’s photos. This can’t be undone.`;

  protected async confirm(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.failed.set(false);
    try {
      await firstValueFrom(this.contacts.deletePhoto(this.data.contactId, this.data.photo.id));
      this.ref.close(true);
    } catch {
      this.failed.set(true);
    } finally {
      this.busy.set(false);
    }
  }
}
