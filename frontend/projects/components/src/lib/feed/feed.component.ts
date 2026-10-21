import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { AlertComponent } from '../alert/alert.component';
import { ButtonComponent } from '../button/button.component';
import { IconComponent } from '../icon/icon.component';
import { SkeletonComponent } from '../skeleton/skeleton.component';

export type FeedState = 'ready' | 'loading' | 'empty' | 'error';

/**
 * Activity feed: a list of `ft-feed-item`s, normally inside a card with a heading. The card keeps
 * its heading in every state: `loading` shows a busy list of skeleton rows, `empty` a plain line of
 * text, and `error` a danger alert whose Try again button emits `retry` (busy while `retrying`).
 */
@Component({
  selector: 'ft-feed',
  imports: [AlertComponent, ButtonComponent, IconComponent, SkeletonComponent],
  templateUrl: './feed.component.html',
  styleUrl: './feed.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.role]': 'isList() ? "list" : null',
    '[attr.aria-label]': 'isList() ? (state() === "loading" ? loadingLabel() : label()) : null',
    '[attr.aria-busy]': 'state() === "loading" ? "true" : null',
  },
})
export class FeedComponent {
  /** Accessible name when no heading names the list. */
  readonly label = input<string | null>(null);
  readonly state = input<FeedState>('ready');
  readonly loadingLabel = input('Loading recent activity');
  readonly emptyText = input(
    'No activity yet. New sign-ups, events and announcements show up here.',
  );
  readonly errorHeading = input('We couldn’t load recent activity');
  readonly retrying = input(false);
  readonly retry = output<void>();

  protected readonly skeletonRows = [0, 1, 2];
  protected readonly isList = computed(
    () => this.state() === 'ready' || this.state() === 'loading',
  );

  protected onRetry(): void {
    if (!this.retrying()) this.retry.emit();
  }
}
