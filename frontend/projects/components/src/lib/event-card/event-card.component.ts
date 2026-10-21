import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { BadgeComponent, BadgeVariant } from '../badge/badge.component';

export type EventVisibility = 'public' | 'members' | 'cancelled';

const BADGES: Record<EventVisibility, { text: string; variant: BadgeVariant }> = {
  public: { text: 'Public', variant: 'info' },
  members: { text: 'Members only', variant: 'neutral' },
  cancelled: { text: 'Cancelled', variant: 'danger' },
};

/**
 * One row in a list of events: a calendar-leaf date badge, the title as the row's only link, a
 * meta line (date, time, place, attendance) and a visibility badge. Place inside a `<ul>`.
 * The date leaf is decorative; the meta line carries the full date.
 */
@Component({
  selector: 'ft-event-card',
  imports: [BadgeComponent],
  templateUrl: './event-card.component.html',
  styleUrl: './event-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'listitem' },
})
export class EventCardComponent {
  readonly title = input.required<string>();
  readonly href = input.required<string>();
  /** Short month for the leaf, e.g. "Nov". For multi-day events, the first day. */
  readonly month = input.required<string>();
  readonly day = input.required<string>();
  /** "Thu 6 Nov · 6:30 pm · Kestrel Labs, 220 King St W · 34 going". */
  readonly meta = input('');
  readonly visibility = input<EventVisibility>('public');

  protected readonly cancelled = computed(() => this.visibility() === 'cancelled');
  protected readonly badge = computed(() => BADGES[this.visibility()]);
}
