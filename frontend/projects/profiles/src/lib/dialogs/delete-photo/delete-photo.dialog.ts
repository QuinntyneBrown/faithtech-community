import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { PROFILES_SERVICE } from '@faithtech-community/api';
import {
  AlertComponent,
  ButtonComponent,
  DialogComponent,
  PhotoComponent,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

export interface DeletePhotoData {
  profileId: string;
  photo: { id: string; url: string | null; altText: string };
}

/**
 * Confirms deleting a saved photo (L2-007 AC6), matching docs/mocks/dialogs/delete-photo.
 * Closes with true once the photo is deleted.
 */
@Component({
  selector: 'ft-delete-photo-dialog',
  imports: [AlertComponent, ButtonComponent, DialogComponent, PhotoComponent],
  templateUrl: './delete-photo.dialog.html',
  styleUrl: './delete-photo.dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeletePhotoDialog {
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly data = inject<DeletePhotoData>(DIALOG_DATA);
  private readonly profiles = inject(PROFILES_SERVICE);

  protected readonly busy = signal(false);
  protected readonly failed = signal(false);
  protected readonly description = `“${this.data.photo.altText}” will be removed from your profile.`;

  protected async confirm(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.failed.set(false);
    try {
      await firstValueFrom(this.profiles.deletePhoto(this.data.profileId, this.data.photo.id));
      this.ref.close(true);
    } catch {
      this.failed.set(true);
    } finally {
      this.busy.set(false);
    }
  }
}
