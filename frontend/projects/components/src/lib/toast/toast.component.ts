import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

export type ToastVariant = 'info' | 'success' | 'warning' | 'danger';

const TOAST_ICONS: Record<ToastVariant, string> = {
  info: 'info',
  success: 'success',
  warning: 'warning',
  danger: 'error',
};

/** Presentational toast card. Queueing and timing live in ToastService / ft-toast-region. */
@Component({
  selector: 'ft-toast',
  imports: [IconComponent],
  templateUrl: './toast.component.html',
  styleUrl: './toast.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToastComponent {
  readonly variant = input<ToastVariant>('info');
  readonly heading = input.required<string>();
  readonly text = input<string | null>(null);
  readonly actionLabel = input<string | null>(null);
  /** Shows the shrinking timer bar; only for toasts that dismiss themselves. */
  readonly timed = input(false);
  /** Timer duration in ms, used by the timer bar animation. */
  readonly duration = input(6000);
  readonly leaving = input(false);

  readonly action = output<void>();
  readonly dismissed = output<void>();
  readonly paused = output<void>();
  readonly resumed = output<void>();

  protected readonly role = computed(() => (this.variant() === 'danger' ? 'alert' : null));
  protected readonly icon = computed(() => TOAST_ICONS[this.variant()]);
}
