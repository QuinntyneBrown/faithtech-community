import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  input,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

let nextId = 0;

/**
 * One on/off choice with a short label (projected), built on a native checkbox. `labelHidden`
 * keeps the projected text as the accessible name but hides it, for a switch trailing a list row
 * that already shows who it is for ("Check in Leah Thompson"; design system, switch).
 * `description` shows a caption under the switch, outside the label so it is not part of the
 * name, and joins it to the input with `aria-describedby` ("Adds them to the attendance list as
 * present.").
 */
@Component({
  selector: 'ft-switch',
  templateUrl: './switch.component.html',
  styleUrl: './switch.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SwitchComponent), multi: true },
  ],
})
export class SwitchComponent implements ControlValueAccessor {
  readonly labelHidden = input(false, { transform: booleanAttribute });
  readonly description = input<string>();

  protected readonly descriptionId = `ft-switch-description-${nextId++}`;

  protected readonly checked = signal(false);
  protected readonly disabled = signal(false);

  private onChange: (value: boolean) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(value: boolean | null): void {
    this.checked.set(!!value);
  }
  registerOnChange(fn: (value: boolean) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  protected onToggle(event: Event): void {
    const value = (event.target as HTMLInputElement).checked;
    this.checked.set(value);
    this.onChange(value);
  }

  protected onBlur(): void {
    this.onTouched();
  }
}
