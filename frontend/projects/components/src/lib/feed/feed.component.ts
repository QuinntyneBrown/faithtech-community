import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Activity feed: a list of `ft-feed-item`s, normally inside a card with a heading. */
@Component({
  selector: 'ft-feed',
  templateUrl: './feed.component.html',
  styleUrl: './feed.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'list', '[attr.aria-label]': 'label()' },
})
export class FeedComponent {
  /** Accessible name when no heading names the list. */
  readonly label = input<string | null>(null);
}
