import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

export type StickerValue = 1 | 2 | 3 | 5 | 8 | 13 | 21 | '?';

const DECK: readonly StickerValue[] = [1, 2, 3, 5, 8, 13, 21, '?'];

let nextId = 0;

/**
 * Single-choice deck of planning-poker cards (1, 2, 3, 5, 8, 13, 21, ?). Each card is a toggle
 * button; pressing the pressed card withdraws the vote. `value` is two-way bindable.
 */
@Component({
  selector: 'ft-sticker-picker',
  templateUrl: './sticker-picker.component.html',
  styleUrl: './sticker-picker.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StickerPickerComponent {
  readonly label = input.required<string>();
  readonly value = model<StickerValue | null>(null);
  /** Locks the deck (after reveal) while keeping the chosen card pressed. */
  readonly disabled = input(false);
  /** A vote the server refused; pair with an inline message. */
  readonly invalid = input(false);

  protected readonly deck = DECK;
  protected readonly labelId = `ft-sticker-picker-label-${nextId++}`;

  protected toggle(card: StickerValue): void {
    if (this.disabled()) return;
    this.value.set(this.value() === card ? null : card);
  }
}
