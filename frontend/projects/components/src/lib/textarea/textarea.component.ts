import {
  booleanAttribute,
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

/** Several lines of text. Place it inside ft-form-field for label, help and error. */
@Component({
  selector: 'ft-textarea',
  templateUrl: './textarea.component.html',
  styleUrl: './textarea.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => TextareaComponent), multi: true },
  ],
})
export class TextareaComponent implements ControlValueAccessor {
  private readonly field = inject(FormFieldComponent, { optional: true });

  readonly rows = input(4);
  readonly placeholder = input('');
  readonly readonly = input(false);
  readonly name = input<string | null>(null);
  /** Takes focus when the dialog that holds it opens (CDK `cdkFocusInitial`). */
  readonly initialFocus = input(false, { transform: booleanAttribute });
  /** Accessible name when used without ft-form-field. */
  readonly label = input<string | null>(null);

  protected readonly value = signal('');
  protected readonly disabled = signal(false);

  protected readonly id = computed(() => this.field?.controlId() ?? null);
  protected readonly describedBy = computed(() => this.field?.describedBy() ?? null);
  protected readonly invalid = computed(() => (this.field?.invalid() ? 'true' : null));
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

  protected onInput(event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    this.value.set(value);
    this.onChange(value);
  }

  protected onBlur(): void {
    this.onTouched();
  }
}
