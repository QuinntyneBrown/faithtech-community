import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CONTACTS_SERVICE, ContactPhoto } from '@faithtech-community/api';
import {
  AlertComponent,
  ButtonComponent,
  DialogComponent,
  PictureListComponent,
  PictureListPhoto,
  StackComponent,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

export interface AddContactPhotoData {
  contactId: string;
  contactName: string;
  /** How many more photos the contact can hold (10 minus its photos). */
  room: number;
}

interface Chosen {
  file: File;
  url: string | null;
  alt: string;
}

// The server's description rule (L2-057).
const MISSING_ALT = 'Describe this photo.';
const MAX_ALT = 300;

/**
 * Adds photos to a contact (L2-056 AC2), matching docs/mocks/dialogs/add-contact-photo: choose up to the
 * room left, describe each, and they upload one by one. Closes with the photos that were added; on a
 * failure it stays open with the rest of the choice.
 */
@Component({
  selector: 'ft-add-contact-photo-dialog',
  imports: [AlertComponent, ButtonComponent, DialogComponent, PictureListComponent, StackComponent],
  templateUrl: './add-contact-photo.dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddContactPhotoDialog {
  protected readonly ref = inject<DialogRef<ContactPhoto[]>>(DialogRef);
  protected readonly data = inject<AddContactPhotoData>(DIALOG_DATA);
  private readonly contacts = inject(CONTACTS_SERVICE);

  protected readonly chosen = signal<Chosen[]>([]);
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);
  private readonly submitted = signal(false);
  private readonly added: ContactPhoto[] = [];

  protected readonly listPhotos = computed<PictureListPhoto[]>(() =>
    this.chosen().map((p) => ({
      url: p.url,
      alt: p.alt,
      featured: false,
      pending: true,
      state: this.busy() ? 'uploading' : undefined,
      altError: this.altError(p),
    })),
  );

  protected pick(files: File[]): void {
    this.chosen.update((list) => [
      ...list,
      ...files.map((file) => ({ file, url: previewUrl(file), alt: '' })),
    ]);
  }

  protected describe({ index, alt }: { index: number; alt: string }): void {
    this.chosen.update((list) => list.map((p, i) => (i === index ? { ...p, alt } : p)));
  }

  protected remove(index: number): void {
    revokePreview(this.chosen()[index]?.url ?? null);
    this.chosen.update((list) => list.filter((_, i) => i !== index));
  }

  protected close(): void {
    for (const photo of this.chosen()) revokePreview(photo.url);
    this.ref.close(this.added.length ? [...this.added] : undefined);
  }

  protected async add(): Promise<void> {
    this.submitted.set(true);
    if (this.busy() || this.chosen().length === 0) return;
    if (this.chosen().some((p) => this.altError(p))) return;

    this.busy.set(true);
    this.failed.set(false);
    try {
      for (const photo of [...this.chosen()]) {
        this.added.push(
          await firstValueFrom(
            this.contacts.uploadPhoto(this.data.contactId, photo.file, photo.alt.trim()),
          ),
        );
        revokePreview(photo.url);
        this.chosen.update((list) => list.filter((p) => p !== photo));
      }
      this.ref.close([...this.added]);
    } catch {
      this.failed.set(true);
    } finally {
      this.busy.set(false);
    }
  }

  private altError(photo: Chosen): string {
    if (!this.submitted()) return '';
    const alt = photo.alt.trim();
    return !alt
      ? MISSING_ALT
      : alt.length > MAX_ALT
        ? `Use ${MAX_ALT} characters or fewer to describe this photo.`
        : '';
  }
}

function previewUrl(file: File): string | null {
  return typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : null;
}

function revokePreview(url: string | null): void {
  if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
}
