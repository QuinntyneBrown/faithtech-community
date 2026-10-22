import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'google';

/**
 * Google's full-colour "G" for the Google sign-in button. The brand mark keeps Google's own colours, as its
 * branding guidelines require (design system: auth forms, iconography: brand marks).
 */
const GOOGLE_MARK =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">' +
      '<path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>' +
      '<path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>' +
      '<path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>' +
      '<path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>' +
      '</svg>',
  );
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
  /** With `href`, "_blank" opens a new tab, always with rel="noopener" (L2-058 AC4). */
  readonly target = input<string | null>(null);
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
  protected readonly googleMark = GOOGLE_MARK;

  protected onHostClick(event: Event): void {
    if (this.inert()) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }
}
