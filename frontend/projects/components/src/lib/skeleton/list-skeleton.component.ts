import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { SkeletonComponent } from './skeleton.component';

/**
 * Loading placeholder for a list or table in a flush card: rows of avatar, title and text skeletons
 * (design system: skeleton, loading list). Busy and labelled for assistive tech. Event lists lead
 * each row with a square date-badge placeholder (`leading="date-badge"`) so rows keep their shape.
 */
@Component({
  selector: 'ft-list-skeleton',
  imports: [SkeletonComponent],
  templateUrl: './list-skeleton.component.html',
  styleUrl: './list-skeleton.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    // A status, so its aria-label is allowed and the wait is announced politely.
    role: 'status',
    'aria-busy': 'true',
    '[attr.aria-label]': 'label()',
  },
})
export class ListSkeletonComponent {
  /** What is loading, e.g. "Loading users". */
  readonly label = input.required<string>();
  readonly rows = input(5);
  /** The row's leading placeholder: a round avatar, or a square date badge for event rows. */
  readonly leading = input<'avatar' | 'date-badge'>('avatar');

  protected readonly items = computed(() => Array.from({ length: this.rows() }, (_, i) => i));
}
