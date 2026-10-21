import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

export type EstimateOption = number | '?';

const DEFAULT_SCALE: EstimateOption[] = [1, 2, 3, 5, 8, 13, 21, '?'];

let nextId = 0;

/**
 * Planning-poker vote picker over a configurable scale. Each card is a toggle button
 * (`aria-pressed`); pressing the pressed card withdraws the vote (`value` becomes null).
 * `disabled` locks the deck after the reveal while keeping the vote shown.
 */
@Component({
  selector: 'ft-estimate-picker',
  templateUrl: './estimate-picker.component.html',
  styleUrl: './estimate-picker.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EstimatePickerComponent {
  readonly label = input.required<string>();
  readonly options = input<EstimateOption[]>(DEFAULT_SCALE);
  readonly value = model<EstimateOption | null>(null);
  readonly disabled = input(false);
  /** A vote the server refused; pair with an inline message. */
  readonly invalid = input(false);

  protected readonly labelId = `ft-estimate-picker-label-${nextId++}`;

  protected toggle(option: EstimateOption): void {
    if (this.disabled()) return;
    this.value.set(this.value() === option ? null : option);
  }
}
