import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { CheckboxGroupComponent } from './checkbox-group.component';

/**
 * A native checkbox drawn as a choice row: a square box that shows a check mark when checked.
 * Must sit inside ft-checkbox-group.
 */
@Component({
  selector: 'ft-checkbox',
  templateUrl: './checkbox.component.html',
  styleUrl: './checkbox.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckboxComponent {
  protected readonly group = inject(CheckboxGroupComponent);

  readonly value = input.required<string>();
  /** Optional small line saying what the option means, such as the person's roles. */
  readonly description = input('');
  readonly disabled = input(false);

  protected readonly checked = computed(() => this.group.isChecked(this.value()));
  protected readonly isDisabled = computed(() => this.disabled() || this.group.disabled());

  protected onChange(event: Event): void {
    this.group.toggle(this.value(), (event.target as HTMLInputElement).checked);
  }
}
