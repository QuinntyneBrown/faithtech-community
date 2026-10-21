import { ChangeDetectionStrategy, Component, input } from '@angular/core';

let nextId = 0;

/** A label over a large number or short value, such as "Lead" over "4". */
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

  protected readonly labelId = `ft-stat-label-${nextId++}`;
}
