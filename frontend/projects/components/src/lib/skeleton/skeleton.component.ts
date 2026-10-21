import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type SkeletonShape = 'text' | 'title' | 'rect' | 'avatar';
export type SkeletonAvatarSize = 'sm' | 'md' | 'lg' | 'xl';

/**
 * Shimmering placeholder in the layout of what is loading. Always aria-hidden: label the loading
 * container with aria-busy="true" and an aria-label such as "Loading contacts".
 */
@Component({
  selector: 'ft-skeleton',
  templateUrl: './skeleton.component.html',
  styleUrl: './skeleton.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
    '[class]':
      '"ft-skeleton--" + shape() + (shape() === "avatar" ? " ft-skeleton--avatar-" + size() : "")',
    '[style.width]': 'width()',
    '[style.height]': 'height()',
  },
})
export class SkeletonComponent {
  readonly shape = input<SkeletonShape>('text');
  /** Avatar shape only. */
  readonly size = input<SkeletonAvatarSize>('sm');
  readonly width = input<string | null>(null);
  readonly height = input<string | null>(null);
}
