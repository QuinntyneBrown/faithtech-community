import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  forwardRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { InlineMessageComponent } from '../inline-message/inline-message.component';

let nextId = 0;

/**
 * Several choices from a few visible options (a member picker, say): a fieldset with a legend,
 * an optional hint and ft-checkbox children. The value is the list of checked option values.
 * Square boxes with a check mark, so it never reads as the single-choice ft-radio-group.
 */
@Component({
  selector: 'ft-checkbox-group',
  imports: [InlineMessageComponent],
  templateUrl: './checkbox-group.component.html',
  styleUrl: './checkbox-group.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CheckboxGroupComponent),
      multi: true,
    },
  ],
})
export class CheckboxGroupComponent implements ControlValueAccessor {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly uid = `ft-checkbox-group-${nextId++}`;

  readonly legend = input.required<string>();
  readonly name = input<string | null>(null);
  /** A line under the legend saying who or what can be chosen. */
  readonly hint = input('');
  readonly error = input('');
  /** Hide the legend visually when a visible heading already names the group (a story's Tasks). */
  readonly legendHidden = input(false);

  readonly value = signal<readonly string[]>([]);
  readonly disabled = signal(false);

  readonly groupName = computed(() => this.name() ?? this.uid);
  protected readonly hintId = `${this.uid}-hint`;
  protected readonly errorId = `${this.uid}-error`;
  protected readonly describedBy = computed(() => {
    const ids = [this.hint() ? this.hintId : '', this.error() ? this.errorId : ''];
    return ids.filter(Boolean).join(' ') || null;
  });

  private onChange: (value: string[]) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(value: readonly string[] | null): void {
    this.value.set(value ?? []);
  }
  registerOnChange(fn: (value: string[]) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  isChecked(value: string): boolean {
    return this.value().includes(value);
  }

  /**
   * Called by ft-checkbox when the person checks or unchecks it. The new value lists the checked
   * options in the order they are shown.
   */
  toggle(value: string, checked: boolean): void {
    const order = Array.from(
      this.host.nativeElement.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
      (box) => box.value,
    );
    const chosen = new Set(this.value());
    if (checked) chosen.add(value);
    else chosen.delete(value);
    const shown = order.filter((v) => chosen.has(v));
    const next = [...shown, ...[...chosen].filter((v) => !order.includes(v))];
    this.value.set(next);
    this.onChange(next);
  }

  touch(): void {
    this.onTouched();
  }
}
