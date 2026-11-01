import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * One list row: optional leading slot (avatar or icon), a title that is a link when `href` is set,
 * a muted meta line (text through `meta`, or rich content such as role badges through the `[meta]` slot)
 * an optional `description` in body text, such as an announcement's message, and an optional trailing slot (badge). Slots: `[leading]`, `[meta]`, `[trailing]`.
 * A row whose title is a link tints on hover; focus stays on the title link's ring.
 */
@Component({
  selector: 'ft-list-item',
  templateUrl: './list-item.component.html',
  styleUrl: './list-item.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'listitem',
    '[class.ft-list-item--link]': '!!href()',
    '[class.ft-list-item--current]': "state() === 'current'",
    '[class.ft-list-item--finished]': "state() === 'finished'",
  },
})
export class ListItemComponent {
  readonly label = input.required<string>();
  readonly href = input<string | null>(null);
  readonly meta = input<string | null>(null);
  /** Longer text under the meta line; line breaks are kept. */
  readonly description = input<string | null>(null);
  /**
   * A row's place in time, such as an agenda's: `current` is highlighted with an accent bar, `finished` is muted. The
   * state is never shown by colour alone; put its words in the `[meta]` slot.
   */
  readonly state = input<'default' | 'current' | 'finished'>('default');
}
