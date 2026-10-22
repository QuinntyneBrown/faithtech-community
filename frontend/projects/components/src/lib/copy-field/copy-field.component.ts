import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ButtonComponent } from '../button/button.component';
import { FormFieldComponent } from '../form-field/form-field.component';
import { IconComponent } from '../icon/icon.component';
import { TextFieldComponent } from '../text-field/text-field.component';

/** How long the button reads "Copied" before it returns to its label. */
export const COPIED_MS = 2000;

/**
 * A read-only value with a Copy button beside it (design system: Copy field). Copying puts the value
 * on the clipboard, turns the button into "Copied" for two seconds and announces it once; when the
 * clipboard is refused the value is selected so it can be copied by hand.
 */
@Component({
  selector: 'ft-copy-field',
  imports: [
    ReactiveFormsModule,
    ButtonComponent,
    FormFieldComponent,
    IconComponent,
    TextFieldComponent,
  ],
  templateUrl: './copy-field.component.html',
  styleUrl: './copy-field.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CopyFieldComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly help = input('');
  readonly copyLabel = input('Copy link');
  readonly disabled = input(false);
  /** Emits after the value reached the clipboard. */
  readonly copied = output<void>();

  protected readonly control = new FormControl('', { nonNullable: true });
  protected readonly state = signal<'idle' | 'copied' | 'refused'>('idle');
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    effect(() => this.control.setValue(this.value()));
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  protected async copy(field: HTMLElement): Promise<void> {
    clearTimeout(this.timer);
    try {
      await navigator.clipboard.writeText(this.value());
      this.state.set('copied');
      this.copied.emit();
      this.timer = setTimeout(() => this.state.set('idle'), COPIED_MS);
    } catch {
      field.querySelector('input')?.select();
      this.state.set('refused');
    }
  }
}
