import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AvatarColor, AvatarComponent } from '../avatar/avatar.component';
import { IconTileComponent } from '../icon-tile/icon-tile.component';

/**
 * One feed entry: the actor avatar, projected rich text (names, links) and a muted meta line.
 * A typed entry, such as a partner's Call or Merged entry, sets `icon` to lead with a small
 * icon tile for its type in place of the avatar.
 */
@Component({
  selector: 'ft-feed-item',
  imports: [AvatarComponent, IconTileComponent],
  templateUrl: './feed-item.component.html',
  styleUrl: './feed-item.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'listitem' },
})
export class FeedItemComponent {
  /** Full name of whoever acted; shown as initials. */
  readonly actor = input.required<string>();
  readonly color = input<AvatarColor>('plain');
  readonly meta = input<string | null>(null);
  /** Icon name for the entry's type (`call`, `email`, `merge`...); replaces the avatar. */
  readonly icon = input<string | null>(null);
}
