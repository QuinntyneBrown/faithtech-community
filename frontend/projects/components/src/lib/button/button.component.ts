import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';
export type ButtonType = 'button' | 'submit' | 'reset';

/**
 * Design system button. Renders a native <button>, or an <a> styled as a button when `href` is set.
 * Icon-only buttons must pass `label`. While `loading` the button is inert and busy.
 */
@Component({
  selector: 'ft-button',
  imports: [NgTemplateOutlet],
  templateUrl: './button.component.html',
  styleUrl: './button.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.ft-button-host--block]': 'block()',
    '(click)': 'onHostClick($event)',
  },
})
export class ButtonComponent {
  readonly variant = input<ButtonVariant>('secondary');
  readonly size = input<ButtonSize>('md');
  readonly type = input<ButtonType>('button');
  readonly disabled = input(false);
  readonly loading = input(false);
  readonly block = input(false);
  readonly iconOnly = input(false);
  /** Accessible name; required for icon-only buttons. */
  readonly label = input<string | null>(null);
  readonly href = input<string | null>(null);
  /**
   * Visually hidden object appended to the accessible name where row actions repeat,
   * for example "Suspend" + " Grace Okonkwo". Prefer it to `label` when the button has visible text.
   */
  readonly object = input<string | null>(null);
  /** Id of text that explains the button, such as why it is disabled. */
  readonly describedBy = input<string | null>(null);
  /** Takes focus when the dialog that holds it opens (CDK `cdkFocusInitial`). */
  readonly initialFocus = input(false, { transform: booleanAttribute });

  protected readonly classes = computed(() => ({
    'ft-button': true,
    [`ft-button--${this.variant()}`]: true,
    [`ft-button--${this.size()}`]: true,
    'ft-button--block': this.block(),
    'ft-button--icon': this.iconOnly(),
  }));

  protected readonly inert = computed(() => this.disabled() || this.loading());

  protected onHostClick(event: Event): void {
    if (this.inert()) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }
}
