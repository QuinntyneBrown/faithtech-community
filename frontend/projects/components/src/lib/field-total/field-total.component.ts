import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

/**
 * A form step's live total, such as "Weights total 100%" or "Segments: 3:00 of 3:00" (design system, inline message:
 * live total). A polite status, so it is read when it changes. Led by a success check while `ok`; off, the text turns
 * danger and the icon an exclamation. It never blocks on its own: on Next or Save the step shows the field error.
 */
@Component({
  selector: 'ft-field-total',
  imports: [IconComponent],
  templateUrl: './field-total.component.html',
  styleUrl: './field-total.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'status', '[class.ft-field-total--off]': '!ok()' },
})
export class FieldTotalComponent {
  /** Whether the sum is right. */
  readonly ok = input(true);
}
