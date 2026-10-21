import { ChangeDetectionStrategy, Component, input } from '@angular/core';

let nextId = 0;

/** `number` (default) for counts; `text` for a value in words, such as a sprint goal or end date. */
export type StatVariant = 'number' | 'text';

/**
 * A label over a large number or short value, such as "Lead" over "4". Values in words take
 * `variant="text"`, a smaller style. Lay a row of stats out with `<ft-cluster gap="8">`.
 */
@Component({
  selector: 'ft-stat',
  templateUrl: './stat.component.html',
  styleUrl: './stat.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'group', '[attr.aria-labelledby]': 'labelId' },
})
export class StatComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly variant = input<StatVariant>('number');

  protected readonly labelId = `ft-stat-label-${nextId++}`;
}
