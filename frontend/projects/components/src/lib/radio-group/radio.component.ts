import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RadioGroupComponent } from './radio-group.component';

/** A native radio drawn as a choice row. Must sit inside ft-radio-group. */
@Component({
  selector: 'ft-radio',
  templateUrl: './radio.component.html',
  styleUrl: './radio.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RadioComponent {
  protected readonly group = inject(RadioGroupComponent);

  readonly value = input.required<string>();
  /** Optional small line saying what the option means. */
  readonly description = input('');
  readonly disabled = input(false);

  protected readonly checked = computed(() => this.group.value() === this.value());
  protected readonly isDisabled = computed(() => this.disabled() || this.group.disabled());
}
