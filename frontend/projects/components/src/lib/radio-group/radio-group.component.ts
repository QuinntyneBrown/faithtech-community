import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  input,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { InlineMessageComponent } from '../inline-message/inline-message.component';

let nextId = 0;

/** `stack` (default) puts one choice per line; `inline` lays short choices out in a wrapping row. */
export type RadioGroupOrientation = 'stack' | 'inline';

/**
 * One choice from a few visible options: a fieldset with a legend and ft-radio children. Short
 * one-word choices (Call, Email, Meeting, Note) may sit in one row with `orientation="inline"`.
 */
@Component({
  selector: 'ft-radio-group',
  imports: [InlineMessageComponent],
  templateUrl: './radio-group.component.html',
  styleUrl: './radio-group.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RadioGroupComponent),
      multi: true,
    },
  ],
})
export class RadioGroupComponent implements ControlValueAccessor {
  private readonly uid = `ft-radio-group-${nextId++}`;

  readonly legend = input.required<string>();
  readonly name = input<string | null>(null);
  readonly error = input('');
  /** Announces the choice as required (`aria-required` on the radiogroup). */
  readonly required = input(false, { transform: booleanAttribute });
  readonly orientation = input<RadioGroupOrientation>('stack');

  readonly value = signal<string | null>(null);
  readonly disabled = signal(false);

  readonly groupName = computed(() => this.name() ?? this.uid);
  protected readonly errorId = `${this.uid}-error`;

  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(value: string | null): void {
    this.value.set(value);
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

  /** Called by ft-radio when the person selects it. */
  select(value: string): void {
    this.value.set(value);
    this.onChange(value);
  }

  touch(): void {
    this.onTouched();
  }
}
