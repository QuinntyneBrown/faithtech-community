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
  host: { role: 'listitem', '[class.ft-list-item--link]': '!!href()' },
})
export class ListItemComponent {
  readonly label = input.required<string>();
  readonly href = input<string | null>(null);
  readonly meta = input<string | null>(null);
  /** Longer text under the meta line; line breaks are kept. */
  readonly description = input<string | null>(null);
}
