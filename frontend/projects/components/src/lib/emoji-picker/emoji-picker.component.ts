import { ChangeDetectionStrategy, Component, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/** The icons a page or callout can have (design system, emoji picker), each with the name screen readers hear. */
export const PAGE_ICONS: readonly { emoji: string; name: string }[] = [
  { emoji: '📘', name: 'Blue book' },
  { emoji: '📝', name: 'Memo' },
  { emoji: '📋', name: 'Clipboard' },
  { emoji: '✅', name: 'Check mark' },
  { emoji: '🛠️', name: 'Hammer and wrench' },
  { emoji: '💡', name: 'Light bulb' },
  { emoji: '🧭', name: 'Compass' },
  { emoji: '📅', name: 'Calendar' },
  { emoji: '🤝', name: 'Handshake' },
  { emoji: '🎯', name: 'Target' },
  { emoji: '🚀', name: 'Rocket' },
  { emoji: '🙏', name: 'Folded hands' },
  { emoji: '⚠️', name: 'Warning' },
  { emoji: '📣', name: 'Megaphone' },
  { emoji: '🏙️', name: 'City' },
  { emoji: '💻', name: 'Laptop' },
];

let nextId = 0;

/**
 * Picks one emoji (design system, emoji picker): a radio group of emoji tiles, each named for screen readers,
 * with an optional "No icon" choice (L2-086 AC3, L2-087 AC6). The value is the emoji, or null for none.
 */
@Component({
  selector: 'ft-emoji-picker',
  templateUrl: './emoji-picker.component.html',
  styleUrl: './emoji-picker.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => EmojiPickerComponent),
      multi: true,
    },
  ],
})
export class EmojiPickerComponent implements ControlValueAccessor {
  readonly legend = input('Icon');
  /** Offers "No icon" first. */
  readonly allowNone = input(true);

  protected readonly icons = PAGE_ICONS;
  protected readonly value = signal<string | null>(null);
  protected readonly disabled = signal(false);
  protected readonly name = `ft-emoji-picker-${nextId++}`;
  private onChange: (value: string | null) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(value: string | null): void {
    this.value.set(value || null);
  }

  registerOnChange(fn: (value: string | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }

  protected choose(value: string | null): void {
    this.value.set(value);
    this.onChange(value);
  }

  protected touch(): void {
    this.onTouched();
  }
}
