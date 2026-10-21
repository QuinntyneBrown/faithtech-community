import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { IconComponent } from '../icon/icon.component';
import { ALERT_ICONS, AlertStatus } from './alert.component';

/** The alert stretched edge to edge between the top bar and main, for account or session news. */
@Component({
  selector: 'ft-banner',
  imports: [IconComponent],
  templateUrl: './banner.component.html',
  styleUrl: './banner.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BannerComponent {
  readonly status = input<AlertStatus>('info');
  readonly heading = input.required<string>();
  readonly dismissible = input(false);
  readonly dismissed = output<void>();

  protected readonly role = computed(() => (this.status() === 'danger' ? 'alert' : 'status'));
  protected readonly icon = computed(() => ALERT_ICONS[this.status()]);
}
