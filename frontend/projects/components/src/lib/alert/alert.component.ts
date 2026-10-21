import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
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
  readonly dismissed = output<void>();

  protected readonly role = computed(() => (this.status() === 'danger' ? 'alert' : 'status'));
  protected readonly icon = computed(() => ALERT_ICONS[this.status()]);
}
