import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AvatarColor, AvatarComponent } from '../avatar/avatar.component';

/** One feed entry: the actor avatar, projected rich text (names, links) and a muted meta line. */
@Component({
  selector: 'ft-feed-item',
  imports: [AvatarComponent],
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
}
