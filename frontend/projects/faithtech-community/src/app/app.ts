import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastRegionComponent } from '@faithtech-community/components';

import { OfflineBannerComponent, ShellPresence } from './shell';

@Component({
  selector: 'ft-root',
  imports: [RouterOutlet, OfflineBannerComponent, ToastRegionComponent],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  protected readonly shells = inject(ShellPresence);
}
