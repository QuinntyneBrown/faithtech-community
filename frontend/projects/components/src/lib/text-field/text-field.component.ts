import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { FormFieldComponent } from '../form-field/form-field.component';

export type TextFieldAction = 'reveal' | 'copy';
/** Small 36px (top bar search, compact rows), medium 44px (forms), large 52px (Search page). */
export type TextFieldSize = 'sm' | 'md' | 'lg';

let nextId = 0;

/**
 * One line of text. Place it inside ft-form-field for the visible label, help
 * and error. `action` adds one trailing icon button (show password, copy link). `min` and `max`
 * pass to the native input (a date capped at today). With a `maxlength` it counts the characters
 * left, as ft-textarea does, and never cuts text off.
 */
@Component({
  selector: 'ft-text-field',
  templateUrl: './text-field.component.html',
  styleUrl: './text-field.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => TextFieldComponent), multi: true },
  ],
})
export class TextFieldComponent implements ControlValueAccessor {
  private readonly field = inject(FormFieldComponent, { optional: true });

  readonly type = input('text');
  readonly placeholder = input('');
  readonly autocomplete = input<string | null>(null);
  readonly readonly = input(false);
  readonly name = input<string | null>(null);
  readonly size = input<TextFieldSize>('md');
  /** Id of the native input when a visible label outside ft-form-field points at it. */
  readonly inputId = input<string | null>(null);
  /** Accessible name when the field is used without ft-form-field. */
  readonly label = input<string | null>(null);
  readonly action = input<TextFieldAction | null>(null);
  /** Takes focus when the dialog that holds it opens (CDK `cdkFocusInitial`). */
  readonly initialFocus = input(false, { transform: booleanAttribute });
  /** Native `min`, such as the earliest date allowed. */
  readonly min = input<string | null>(null);
  /** Native `max`, such as today's date for an activity date. */
  readonly max = input<string | null>(null);
  /** Character limit shown as a counter under the field. */
  readonly maxlength = input<number | null>(null);
  readonly actionClick = output<void>();

  protected readonly value = signal('');
  protected readonly disabled = signal(false);
  protected readonly revealed = signal(false);

  protected readonly id = computed(() => this.field?.controlId() ?? this.inputId());
  protected readonly countId = `ft-text-field-${nextId++}-count`;
  protected readonly left = computed(() => {
    const max = this.maxlength();
    return max === null ? null : max - this.value().length;
  });
  protected readonly countText = computed(() => {
    const left = this.left() ?? 0;
    const n = Math.abs(left);
    const characters = n === 1 ? 'character' : 'characters';
    return left >= 0 ? `${n} ${characters} left` : `${n} ${characters} too many`;
  });
  protected readonly describedBy = computed(() => {
    const ids = [this.left() === null ? '' : this.countId, this.field?.describedBy() ?? ''];
    return ids.filter(Boolean).join(' ') || null;
  });
  protected readonly invalid = computed(() => (this.field?.invalid() ? 'true' : null));
  protected readonly required = computed(() => (this.field?.required() ? 'true' : null));
  protected readonly ariaLabel = computed(() => (this.field ? null : this.label()));
  protected readonly effectiveType = computed(() =>
    this.action() === 'reveal' && this.revealed() ? 'text' : this.type(),
  );
  protected readonly buttonLabel = computed(() =>
    this.action() === 'copy' ? 'Copy link' : 'Show password',
  );

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
    const value = (event.target as HTMLInputElement).value;
    this.value.set(value);
    this.onChange(value);
  }

  protected onBlur(): void {
    this.onTouched();
  }

  protected onAction(): void {
    if (this.action() === 'reveal') this.revealed.update((v) => !v);
    else this.actionClick.emit();
  }
}
