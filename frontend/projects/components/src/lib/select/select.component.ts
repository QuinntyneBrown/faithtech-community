import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { FormFieldComponent } from '../form-field/form-field.component';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/** Native select restyled on the closed control. Place it inside ft-form-field. */
@Component({
  selector: 'ft-select',
  templateUrl: './select.component.html',
  styleUrl: './select.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SelectComponent), multi: true },
  ],
})
export class SelectComponent implements ControlValueAccessor {
  private readonly field = inject(FormFieldComponent, { optional: true });

  readonly options = input<SelectOption[]>([]);
  /** Adds an empty first option with this text. */
  readonly placeholder = input('');
  readonly name = input<string | null>(null);
  /** Accessible name when used without ft-form-field. */
  readonly label = input<string | null>(null);

  protected readonly value = signal('');
  protected readonly disabled = signal(false);

  protected readonly id = computed(() => this.field?.controlId() ?? null);
  protected readonly describedBy = computed(() => this.field?.describedBy() ?? null);
  protected readonly invalid = computed(() => (this.field?.invalid() ? 'true' : null));
  protected readonly required = computed(() => (this.field?.required() ? 'true' : null));
  protected readonly ariaLabel = computed(() => (this.field ? null : this.label()));

  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(value: string | null): void {
    this.value.set(value ?? '');
  }
  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  protected onChangeEvent(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.value.set(value);
    this.onChange(value);
  }

  protected onBlur(): void {
    this.onTouched();
  }
}
