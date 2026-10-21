import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {
  BannerComponent,
  ConnectivityService,
  ToastRegionComponent,
} from '@faithtech-community/components';

@Component({
  selector: 'ft-root',
  imports: [RouterOutlet, BannerComponent, ToastRegionComponent],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  protected readonly connectivity = inject(ConnectivityService);
}
