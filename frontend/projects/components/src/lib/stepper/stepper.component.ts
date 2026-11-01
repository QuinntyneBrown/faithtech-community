import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Wizard progress (components/stepper.html): "Step 2 of 4" and the step's name over one segment per step. The status line
 * carries the position (give it `statusId` so a dialog can describe itself by it); the list names every step for
 * assistive tech. `current` is 1-based.
 */
@Component({
  selector: 'ft-stepper',
  templateUrl: './stepper.component.html',
  styleUrl: './stepper.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StepperComponent {
  readonly steps = input.required<readonly string[]>();
  readonly current = input.required<number>();
  readonly statusId = input<string | null>(null);
  readonly label = input('Progress');

  protected readonly name = computed(() => this.steps()[this.current() - 1] ?? '');
}
