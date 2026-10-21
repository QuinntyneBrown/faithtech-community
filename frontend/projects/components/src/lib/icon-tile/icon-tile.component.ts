import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

export type IconTileSize = 'sm' | 'md';

/**
 * A rounded accent-subtle tile holding one icon, the leading mark of a list row such as a
 * workspace or an invite (design system, list: icon tile). Decorative: the row's text names it.
 */
@Component({
  selector: 'ft-icon-tile',
  imports: [IconComponent],
  templateUrl: './icon-tile.component.html',
  styleUrl: './icon-tile.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
    class: 'ft-icon-tile',
    '[class.ft-icon-tile--sm]': 'size() === "sm"',
  },
})
export class IconTileComponent {
  readonly name = input.required<string>();
  readonly size = input<IconTileSize>('md');
}
