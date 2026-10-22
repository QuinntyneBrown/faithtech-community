import {
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

import { avatarColorFor } from '../avatar/avatar-color';
import { AvatarComponent } from '../avatar/avatar.component';
import { FormFieldComponent } from '../form-field/form-field.component';
import { IconComponent } from '../icon/icon.component';

/** A member offered by the picker: their name and a line of context such as "City Lead · Toronto". */
export interface PersonOption {
  id: string;
  name: string;
  detail?: string | null;
}

let nextId = 0;

/**
 * Pick members by name (design system, person picker): an APG combobox whose suggestions show
 * name and context, with the chosen members as removable chips. `multiple` false keeps one
 * choice, as for a new owner. Place it inside ft-form-field. The value is the chosen people.
 */
@Component({
  selector: 'ft-person-picker',
  imports: [AvatarComponent, IconComponent],
  templateUrl: './person-picker.component.html',
  styleUrl: './person-picker.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => PersonPickerComponent),
      multi: true,
    },
  ],
})
export class PersonPickerComponent implements ControlValueAccessor {
  private readonly field = inject(FormFieldComponent, { optional: true });

  /** Members matching what is typed; the page loads them on `query`. */
  readonly options = input<PersonOption[]>([]);
  readonly multiple = input(true);
  readonly placeholder = input('Search members by name');
  readonly listLabel = input('Members');
  /** Shown in the panel while the page loads matches. */
  readonly loading = input(false);
  readonly query = output<string>();

  protected readonly chosen = signal<PersonOption[]>([]);
  protected readonly text = signal('');
  protected readonly open = signal(false);
  protected readonly active = signal(0);
  protected readonly disabled = signal(false);

  private readonly uid = `ft-person-picker-${nextId++}`;
  protected readonly listId = `${this.uid}-list`;
  protected readonly id = computed(() => this.field?.controlId() ?? `${this.uid}-field`);
  protected readonly describedBy = computed(() => this.field?.describedBy() ?? null);
  protected readonly invalid = computed(() => (this.field?.invalid() ? 'true' : null));

  protected readonly matches = computed(() => {
    const ids = this.chosen().map((p) => p.id);
    return this.options().filter((p) => !ids.includes(p.id));
  });
  protected readonly expanded = computed(
    () => this.open() && !!this.text().trim() && (this.matches().length > 0 || this.loading()),
  );

  private onChange: (value: PersonOption[]) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(value: PersonOption[] | null): void {
    this.chosen.set([...(value ?? [])]);
  }
  registerOnChange(fn: (value: PersonOption[]) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  protected readonly colorFor = avatarColorFor;

  protected optionId(index: number): string {
    return `${this.uid}-option-${index}`;
  }

  protected onInput(event: Event): void {
    this.text.set((event.target as HTMLInputElement).value);
    this.active.set(0);
    this.open.set(true);
    this.query.emit(this.text().trim());
  }

  protected onKeydown(event: KeyboardEvent): void {
    const matches = this.matches();
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.open.set(true);
        this.active.set(Math.min(this.active() + 1, matches.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.active.set(Math.max(this.active() - 1, 0));
        break;
      case 'Enter':
        if (this.expanded() && matches[this.active()]) {
          event.preventDefault();
          this.choose(matches[this.active()]);
        }
        break;
      case 'Escape':
        if (this.expanded()) {
          event.stopPropagation();
          this.open.set(false);
        }
        break;
      case 'Backspace':
        if (!this.text() && this.chosen().length)
          this.remove(this.chosen()[this.chosen().length - 1]);
        break;
    }
  }

  protected choose(person: PersonOption): void {
    this.update(this.multiple() ? [...this.chosen(), person] : [person]);
    this.text.set('');
    this.open.set(false);
  }

  protected remove(person: PersonOption): void {
    this.update(this.chosen().filter((p) => p.id !== person.id));
  }

  protected onBlur(): void {
    this.open.set(false);
    this.onTouched();
  }

  private update(people: PersonOption[]): void {
    this.chosen.set(people);
    this.onChange(people);
  }
}
