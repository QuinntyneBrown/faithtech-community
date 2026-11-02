import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * An editable, ordered list of row cards in a wizard step: Rules, Tracks, Parking options (design system, repeat
 * list). Holds `ft-repeat-row`s; the caller owns the rows and their order.
 */
@Component({
  selector: 'ft-repeat-list',
  templateUrl: './repeat-list.component.html',
  styleUrl: './repeat-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RepeatListComponent {
  /** Accessible name of the list, such as "Rules". */
  readonly label = input.required<string>();
}
