import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { SkeletonComponent } from '../skeleton/skeleton.component';

let nextId = 0;

/** `number` (default) for counts; `text` for a value in words, such as a sprint goal or end date. */
export type StatVariant = 'number' | 'text';

/**
 * A label over a large number or short value, such as "Lead" over "4". Values in words take
 * `variant="text"`, a smaller style. While `loading`, the label stays and a skeleton stands in
 * for the value. A zero count reads "0". Lay a row of stats out with `<ft-cluster gap="8">`.
 */
@Component({
  selector: 'ft-stat',
  imports: [SkeletonComponent],
  templateUrl: './stat.component.html',
  styleUrl: './stat.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'group',
    '[attr.aria-labelledby]': 'labelId',
    '[attr.aria-busy]': 'loading() ? "true" : null',
  },
})
export class StatComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly variant = input<StatVariant>('number');
  readonly loading = input(false);

  protected readonly labelId = `ft-stat-label-${nextId++}`;
}
