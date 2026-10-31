import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { NOTES_SERVICE, OrganisationNames } from '@faithtech-community/api';
import {
  AlertComponent,
  ButtonComponent,
  DialogComponent,
  FileDropzoneComponent,
  FormFieldComponent,
  TextFieldComponent,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

export interface AddedImage {
  imageId: string;
  alt: string;
}

export const MAX_ALT = 250;
const MAX_BYTES = 5 * 1024 * 1024;
const REFUSAL = 'Use a JPEG, PNG or WebP image up to 5 MB.';
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** The alt-text rule shared with Edit alt text (L2-097 AC2): required, at most 250 characters. */
export function altError(alt: string): string {
  if (!alt.trim()) return 'Describe this image';
  return alt.trim().length > MAX_ALT ? `Use ${MAX_ALT} characters or fewer for the alt text.` : '';
}

/**
 * "Add an image" (L2-097 AC1-AC4, AC9), as in docs/mocks/dialogs/add-image. Nothing is uploaded until the image
 * and its alt text are both valid; closes with the uploaded image's id and the alt text.
 */
@Component({
  selector: 'ft-add-image-dialog',
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    ButtonComponent,
    DialogComponent,
    FileDropzoneComponent,
    FormFieldComponent,
    TextFieldComponent,
  ],
  templateUrl: './add-image.dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddImageDialog {
  protected readonly organisation = inject(OrganisationNames);
  protected readonly ref = inject<DialogRef<AddedImage>>(DialogRef);
  private readonly pageId = inject<string>(DIALOG_DATA);
  private readonly notes = inject(NOTES_SERVICE);

  protected readonly alt = new FormControl('', { nonNullable: true });
  protected readonly file = signal<File | null>(null);
  protected readonly fileError = signal('');
  protected readonly altProblem = signal('');
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);

  protected choose(files: File[]): void {
    const file = files[0] ?? null;
    const ok = !!file && TYPES.includes(file.type) && file.size > 0 && file.size <= MAX_BYTES;
    this.file.set(ok ? file : null);
    this.fileError.set(ok ? '' : REFUSAL);
  }

  protected async add(): Promise<void> {
    if (this.busy()) return;
    this.altProblem.set(altError(this.alt.value));
    if (!this.file() && !this.fileError()) this.fileError.set('Choose an image to add.');
    const file = this.file();
    if (!file || this.altProblem()) return;
    this.busy.set(true);
    this.failed.set(false);
    try {
      const uploaded = await firstValueFrom(this.notes.uploadImage(this.pageId, file));
      this.ref.close({ imageId: uploaded.imageId, alt: this.alt.value.trim() });
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 400) this.fileError.set(REFUSAL);
      else this.failed.set(true);
    } finally {
      this.busy.set(false);
    }
  }
}
