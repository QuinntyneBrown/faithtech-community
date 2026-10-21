import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { InlineMessageComponent } from '../inline-message/inline-message.component';

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
  imports: [InlineMessageComponent],
  templateUrl: './estimate-picker.component.html',
  styleUrl: './estimate-picker.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EstimatePickerComponent {
  readonly label = input.required<string>();
  readonly options = input<EstimateOption[]>(DEFAULT_SCALE);
  readonly value = model<EstimateOption | null>(null);
  readonly disabled = input(false);
  /** A vote the server refused; prefer `error`, which also says why. */
  readonly invalid = input(false);
  /**
   * Why the server refused the vote ("Voting has closed on this story…"). Shown under the deck
   * as an inline message that describes the group, which is marked invalid.
   */
  readonly error = input('');

  private readonly uid = nextId++;
  protected readonly labelId = `ft-estimate-picker-label-${this.uid}`;
  protected readonly errorId = `ft-estimate-picker-error-${this.uid}`;
  protected readonly isInvalid = computed(() => this.invalid() || !!this.error());

  protected toggle(option: EstimateOption): void {
    if (this.disabled()) return;
    this.value.set(this.value() === option ? null : option);
  }
}
