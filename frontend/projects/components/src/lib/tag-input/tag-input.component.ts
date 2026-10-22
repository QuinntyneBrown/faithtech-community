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

import { FormFieldComponent } from '../form-field/form-field.component';
import { IconComponent } from '../icon/icon.component';

/** A tag already in use, offered while typing. */
export interface TagSuggestion {
  name: string;
  count: number;
}

let nextId = 0;

/**
 * Free-text tags as removable chips in one field (design system, tag input), with an APG combobox
 * that suggests tags already in use. Enter or comma adds; tags are lower-cased, trimmed and
 * de-duplicated. Place it inside ft-form-field. The value is the list of tags.
 */
@Component({
  selector: 'ft-tag-input',
  imports: [IconComponent],
  templateUrl: './tag-input.component.html',
  styleUrl: './tag-input.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => TagInputComponent), multi: true },
  ],
})
export class TagInputComponent implements ControlValueAccessor {
  private readonly field = inject(FormFieldComponent, { optional: true });

  /** Tags in use that match what is typed; the page loads them on `query`. */
  readonly suggestions = input<TagSuggestion[]>([]);
  readonly listLabel = input('Tags already in use');
  /** The text typed so far, for the page to look up suggestions. */
  readonly query = output<string>();

  protected readonly tags = signal<string[]>([]);
  protected readonly text = signal('');
  protected readonly open = signal(false);
  protected readonly active = signal(0);
  protected readonly disabled = signal(false);

  private readonly uid = `ft-tag-input-${nextId++}`;
  protected readonly listId = `${this.uid}-list`;
  protected readonly id = computed(() => this.field?.controlId() ?? `${this.uid}-field`);
  protected readonly describedBy = computed(() => this.field?.describedBy() ?? null);
  protected readonly invalid = computed(() => (this.field?.invalid() ? 'true' : null));

  /** Matching suggestions not yet chosen, then "Add … as a new tag" when the text is new. */
  protected readonly options = computed(() => {
    const typed = normalise(this.text());
    const chosen = this.tags();
    const matches = this.suggestions().filter(
      (s) => !chosen.includes(s.name) && (!typed || s.name.includes(typed)),
    );
    const isNew = !!typed && !chosen.includes(typed) && !matches.some((s) => s.name === typed);
    return [
      ...matches.map((s) => ({ value: s.name, title: s.name, detail: usedOn(s.count) })),
      ...(isNew ? [{ value: typed, title: `Add “${typed}” as a new tag`, detail: null }] : []),
    ];
  });

  protected readonly expanded = computed(() => this.open() && this.options().length > 0);

  private onChange: (value: string[]) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(value: string[] | null): void {
    this.tags.set([...(value ?? [])]);
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

  protected optionId(index: number): string {
    return `${this.uid}-option-${index}`;
  }

  protected onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (value.includes(',')) {
      value.split(',').forEach((part) => this.add(part));
      this.setText('');
      return;
    }
    this.setText(value);
    this.open.set(true);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const options = this.options();
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.open.set(true);
        this.active.set(Math.min(this.active() + 1, options.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.active.set(Math.max(this.active() - 1, 0));
        break;
      case 'Enter': {
        if (!this.text().trim() && !this.expanded()) return;
        event.preventDefault();
        const option = this.expanded() ? options[this.active()] : null;
        this.add(option?.value ?? this.text());
        this.setText('');
        break;
      }
      case 'Escape':
        if (this.expanded()) {
          event.stopPropagation();
          this.open.set(false);
        }
        break;
      case 'Backspace':
        if (!this.text() && this.tags().length) this.remove(this.tags()[this.tags().length - 1]);
        break;
    }
  }

  protected choose(value: string): void {
    this.add(value);
    this.setText('');
  }

  protected remove(tag: string): void {
    this.update(this.tags().filter((t) => t !== tag));
  }

  protected onBlur(): void {
    this.open.set(false);
    this.onTouched();
  }

  private add(raw: string): void {
    const tag = normalise(raw);
    if (tag && !this.tags().includes(tag)) this.update([...this.tags(), tag]);
  }

  private update(tags: string[]): void {
    this.tags.set(tags);
    this.onChange(tags);
  }

  private setText(value: string): void {
    this.text.set(value);
    this.active.set(0);
    this.query.emit(normalise(value));
  }
}

function normalise(value: string): string {
  return value.trim().toLowerCase();
}

function usedOn(count: number): string {
  return `Used on ${count} ${count === 1 ? 'resource' : 'resources'}`;
}
