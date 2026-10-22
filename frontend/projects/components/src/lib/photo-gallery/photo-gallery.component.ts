import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { BadgeComponent } from '../badge/badge.component';
import { ButtonComponent } from '../button/button.component';
import { IconComponent } from '../icon/icon.component';

export interface PhotoGalleryPhoto {
  id: string;
  /** Null while the photo is storing, or before its image has loaded. */
  url: string | null;
  alt: string;
  featured: boolean;
  /** Saved, but its image is still being written to storage. */
  storing?: boolean;
}

/**
 * Saved photos with their descriptions (docs/design-system/components/photo-gallery.html): the featured
 * photo is ringed and badged, a storing photo is a described placeholder with a status note, and each photo
 * offers Feature (when not featured), Edit description and Delete. Emits the photo's index; the page opens
 * the dialogs. Changes nothing itself.
 */
@Component({
  selector: 'ft-photo-gallery',
  imports: [BadgeComponent, ButtonComponent, IconComponent],
  templateUrl: './photo-gallery.component.html',
  styleUrl: './photo-gallery.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhotoGalleryComponent {
  readonly photos = input<PhotoGalleryPhoto[]>([]);

  readonly featured = output<number>();
  readonly describe = output<number>();
  readonly remove = output<number>();
}
