import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * The token column grid (`--layout-columns`, which changes with the breakpoint). `columns`
 * overrides the count (a Starts/Ends pair); `auto` fills with 18rem-minimum cards instead.
 */
@Component({
  selector: 'ft-grid',
  templateUrl: './grid.component.html',
  styleUrl: './grid.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.ft-grid--auto]': 'auto()',
    '[style.--layout-columns]': 'columns()',
  },
})
export class GridComponent {
  readonly columns = input<number | null>(null);
  readonly auto = input(false);
}
