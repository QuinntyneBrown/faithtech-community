import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Form widths (`.form-width--sm/md/lg`): 40rem, 44rem, 48rem. */
export type StackWidth = 'sm' | 'md' | 'lg';

/**
 * Children in a column. `gap` is a space token step (`'2'`, `'3'`, `'4'` default, `'6'`, `'8'`).
 * `width` caps a form or a form's replacement (such as a success card) at a form width.
 */
@Component({
  selector: 'ft-stack',
  templateUrl: './stack.component.html',
  styleUrl: './stack.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.--ft-stack-gap]': '"var(--space-" + gap() + ")"',
    '[class.ft-stack--width-sm]': 'width() === "sm"',
    '[class.ft-stack--width-md]': 'width() === "md"',
    '[class.ft-stack--width-lg]': 'width() === "lg"',
  },
})
export class StackComponent {
  readonly gap = input('4');
  readonly width = input<StackWidth | null>(null);
}
