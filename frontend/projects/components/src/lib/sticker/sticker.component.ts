import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';

export type StickerSize = 'md' | 'lg' | 'xl';

/**
 * Round sticker: an emoji or short value on an accent tint, optionally covered by a picture.
 * Decorative unless `label` is set, in which case it is an image named by the label
 * (for example "Grace Okonkwo: 8 points"). A picture that fails to load is removed.
 */
@Component({
  selector: 'ft-sticker',
  templateUrl: './sticker.component.html',
  styleUrl: './sticker.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StickerComponent {
  readonly size = input<StickerSize>('md');
  readonly label = input<string | null>(null);
  readonly src = input<string | null>(null);

  protected readonly failedSrc = signal<string | null>(null);
}
