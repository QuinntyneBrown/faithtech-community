import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Children in a column. `gap` is a space token step (`'2'`, `'3'`, `'4'` default, `'6'`, `'8'`). */
@Component({
  selector: 'ft-stack',
  templateUrl: './stack.component.html',
  styleUrl: './stack.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[style.--ft-stack-gap]': '"var(--space-" + gap() + ")"' },
})
export class StackComponent {
  readonly gap = input('4');
}
