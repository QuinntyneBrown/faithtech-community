import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  output,
  signal,
  viewChild,
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
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024;

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
  protected readonly rejections = signal<string[]>([]);
  protected readonly full = computed(() => this.photos().length >= this.max());
  protected readonly accept = ACCEPTED_TYPES.join(',');

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
