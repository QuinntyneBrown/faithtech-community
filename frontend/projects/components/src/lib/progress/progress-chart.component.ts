import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { SkeletonComponent } from '../skeleton/skeleton.component';

/** One bar: the category, its count and, optionally, the text shown instead of the bare count. */
export interface ProgressChartRow {
  readonly label: string;
  readonly value: number;
  /** Shown in place of the count, such as "12 so far" for the current month. */
  readonly valueText?: string;
}

/**
 * A bar chart: a list of rows sharing one label column, each bar scaled to the largest value
 * so the bars compare categories (design system, progress: Bar chart). The row text carries the
 * data and each track is aria-hidden; it is never a progressbar. `label` names the list, usually
 * the card's heading. While `loading`, the list stays named and busy with skeleton rows.
 */
@Component({
  selector: 'ft-progress-chart',
  imports: [SkeletonComponent],
  templateUrl: './progress-chart.component.html',
  styleUrl: './progress-chart.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProgressChartComponent {
  readonly rows = input.required<readonly ProgressChartRow[]>();
  readonly label = input.required<string>();
  readonly loading = input(false);

  protected readonly skeletonRows = [0, 1, 2, 3, 4];

  protected readonly bars = computed(() => {
    const rows = this.rows();
    const largest = Math.max(0, ...rows.map((r) => r.value));
    return rows.map((r) => ({
      label: r.label,
      text: r.valueText ?? String(r.value),
      percent: largest > 0 ? Math.round((Math.max(0, r.value) / largest) * 100) : 0,
    }));
  });
}
