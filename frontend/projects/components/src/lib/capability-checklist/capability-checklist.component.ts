import { ChangeDetectionStrategy, Component, forwardRef, input } from '@angular/core';
import {
  ControlValueAccessor,
  FormControl,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
} from '@angular/forms';

import { CheckboxComponent } from '../checkbox-group/checkbox.component';
import { CheckboxGroupComponent } from '../checkbox-group/checkbox-group.component';

/** One entry of a fixed catalogue: a capability, or a role in the grants dialog. */
export interface ChecklistEntry {
  value: string;
  label: string;
  description: string;
  /** Disables the entry and is read in place of its description, such as who can grant it. */
  disabledReason?: string;
}

/**
 * Every entry of a fixed catalogue as a checkbox with a one-line description, in two columns from 48rem
 * (docs/design-system/components/capability-checklist). It knows no capability or role name: the entries are data.
 * The value is the checked entries' values in the order shown.
 */
@Component({
  selector: 'ft-capability-checklist',
  imports: [ReactiveFormsModule, CheckboxComponent, CheckboxGroupComponent],
  templateUrl: './capability-checklist.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CapabilityChecklistComponent),
      multi: true,
    },
  ],
})
export class CapabilityChecklistComponent implements ControlValueAccessor {
  readonly legend = input.required<string>();
  readonly entries = input<readonly ChecklistEntry[]>([]);
  /** One column, as the grants dialog uses. */
  readonly single = input(false);
  readonly error = input('');

  protected readonly chosen = new FormControl<string[]>([], { nonNullable: true });
  private onTouched: () => void = () => undefined;

  writeValue(value: readonly string[] | null): void {
    this.chosen.setValue([...(value ?? [])], { emitEvent: false });
  }
  registerOnChange(fn: (value: string[]) => void): void {
    this.chosen.valueChanges.subscribe(fn);
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(isDisabled: boolean): void {
    if (isDisabled) this.chosen.disable({ emitEvent: false });
    else this.chosen.enable({ emitEvent: false });
  }
}
