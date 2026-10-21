import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  output,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BadgeComponent } from '../badge/badge.component';
import { ButtonComponent } from '../button/button.component';
import { FormFieldComponent } from '../form-field/form-field.component';
import { IconComponent } from '../icon/icon.component';
import { PhotoComponent, PhotoState } from '../photo/photo.component';
import { TextFieldComponent } from '../text-field/text-field.component';

export interface PictureListPhoto {
  url: string;
  alt: string;
  featured: boolean;
  state?: PhotoState;
  progress?: number;
  error?: string;
  /** Chosen but not saved yet: no Feature action, and a "Not saved yet" note. */
  pending?: boolean;
  /** The description error to show; when absent the list asks for a missing description itself. */
  altError?: string;
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024;
const MISSING_ALT = 'Describe what’s in the photo for people using screen readers.';
let nextId = 0;

/**
 * A member's profile photos as square thumbnails, up to `max`. One is featured; every photo needs
 * a description. Uploads nothing itself: checks each chosen file's type and size, then emits what
 * the member asked for (`picked`, `removed`, `featured`, `altChange`).
 */
@Component({
  selector: 'ft-picture-list',
  imports: [
    FormsModule,
    BadgeComponent,
    ButtonComponent,
    FormFieldComponent,
    IconComponent,
    PhotoComponent,
    TextFieldComponent,
  ],
  templateUrl: './picture-list.component.html',
  styleUrl: './picture-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PictureListComponent {
  readonly photos = input<PictureListPhoto[]>([]);
  readonly max = input(10);

  /** Files that passed the type and size checks. */
  readonly picked = output<File[]>();
  /** Index of the photo the member asked to remove (the app confirms first). */
  readonly removed = output<number>();
  readonly featured = output<number>();
  readonly altChange = output<{ index: number; alt: string }>();

  protected readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');
  protected readonly addButton = viewChild.required('addButton', { read: ElementRef });
  private readonly descriptionFields = viewChildren(FormFieldComponent);
  protected readonly noteId = `ft-picture-list-note-${nextId++}`;
  protected readonly rejections = signal<string[]>([]);
  protected readonly full = computed(() => this.photos().length >= this.max());
  protected readonly accept = ACCEPTED_TYPES.join(',');

  /** Id of photo `index`'s description field, so an error summary can link to it. */
  descriptionFieldId(index: number): string {
    return this.descriptionFields()[index]?.controlId() ?? '';
  }

  protected altError(photo: PictureListPhoto): string {
    if (photo.altError !== undefined) return photo.altError;
    return photo.alt.trim() === '' && photo.state !== 'uploading' && !photo.pending
      ? MISSING_ALT
      : '';
  }

  protected openChooser(): void {
    this.fileInput().nativeElement.click();
  }

  protected onFiles(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    const accepted: File[] = [];
    const notes: string[] = [];
    for (const file of files) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        notes.push(`${file.name} isn’t a photo we can use. Photos must be JPEG, PNG or WebP.`);
      } else if (file.size > MAX_BYTES) {
        const mb = (file.size / (1024 * 1024)).toFixed(1);
        notes.push(`${file.name} is ${mb} MB. Photos can be up to 5 MB — try a smaller one.`);
      } else {
        accepted.push(file);
      }
    }
    this.rejections.set(notes);
    const room = Math.max(0, this.max() - this.photos().length);
    if (accepted.length > 0 && room > 0) this.picked.emit(accepted.slice(0, room));
    try {
      input.value = '';
    } catch {
      // Test doubles may not allow resetting the value.
    }
  }

  protected remove(index: number): void {
    this.removed.emit(index);
    (this.addButton().nativeElement as HTMLElement).querySelector('button')?.focus();
  }
}
