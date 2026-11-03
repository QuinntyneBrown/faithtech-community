import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type BadgeVariant = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'role' | 'count';

/**
 * Small non-interactive pill. Status tints carry a dot; `role` and `count` do not. A `role` badge
 * takes a `tone`, the tint of a work-item kind (the mocks' `badge--role badge--success`).
 */
@Component({
  selector: 'ft-badge',
  templateUrl: './badge.component.html',
  styleUrl: './badge.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BadgeComponent {
  readonly variant = input<BadgeVariant>('neutral');
  /** The tint of a sentence-case `role` badge, such as `success` for a Story. */
  readonly tone = input<BadgeVariant | null>(null);
}
