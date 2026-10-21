import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

/**
 * Filter chip: a toggle <button aria-pressed>. With `href` it is a view chip: an <a> that carries
 * aria-current="page" when `current`. Chips in a group are un-pressed by the page, not by the chip.
 */
@Component({
  selector: 'ft-chip',
  imports: [NgTemplateOutlet],
  templateUrl: './chip.component.html',
  styleUrl: './chip.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChipComponent {
  readonly pressed = model(false);
  readonly disabled = input(false);
  readonly href = input<string | null>(null);
  readonly current = input(false);

  protected toggle(): void {
    if (!this.disabled()) this.pressed.set(!this.pressed());
  }
}
