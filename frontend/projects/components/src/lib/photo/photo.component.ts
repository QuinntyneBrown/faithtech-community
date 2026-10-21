import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type PhotoState = 'uploading' | 'failed';

/**
 * Square photo thumbnail. The alt text is the member's own description. Shows an accent ring when
 * featured, a busy spinner with a polite progress line while uploading, and a danger border when
 * the upload failed. Projected content (a Remove button, say) is placed over the corner.
 */
@Component({
  selector: 'ft-photo',
  templateUrl: './photo.component.html',
  styleUrl: './photo.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhotoComponent {
  readonly src = input<string | null>(null);
  readonly alt = input('');
  readonly featured = input(false);
  readonly state = input<PhotoState | null>(null);
  /** Percentage 0-100, shown while `state` is "uploading". */
  readonly progress = input<number | null>(null);
}
