import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { IconComponent } from '../icon/icon.component';

export type AlertStatus = 'info' | 'success' | 'warning' | 'danger';

export const ALERT_ICONS: Record<AlertStatus, string> = {
  info: 'info',
  success: 'success',
  warning: 'warning',
  danger: 'error',
};

/**
 * A tinted message that stays where it is. Default content is the supporting text; mark
 * actions with `ftAlertActions`. Danger announces assertively (role=alert), the rest politely.
 * `polite` makes a danger alert role=status too, for one that describes the record's state when
 * the page loads (a cancelled event) rather than something that just failed.
 */
@Component({
  selector: 'ft-alert',
  imports: [IconComponent],
  templateUrl: './alert.component.html',
  styleUrl: './alert.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlertComponent {
  readonly status = input<AlertStatus>('info');
  readonly heading = input.required<string>();
  readonly dismissible = input(false);
  /** Lets the alert take focus as a form's error summary (see FormErrorFocusDirective). */
  readonly focusable = input(false);
  /** Use role=status even for danger: the alert states the record's state, nothing just failed. */
  readonly polite = input(false, { transform: booleanAttribute });
  readonly dismissed = output<void>();

  protected readonly role = computed(() =>
    this.status() === 'danger' && !this.polite() ? 'alert' : 'status',
  );
  protected readonly icon = computed(() => ALERT_ICONS[this.status()]);
}
