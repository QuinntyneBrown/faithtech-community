import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Injectable,
  inject,
  signal,
} from '@angular/core';
import { BannerComponent, ConnectivityService } from '@faithtech-community/components';

/** How many shells are on screen, so the app draws the offline banner itself only on pages without one. */
@Injectable({ providedIn: 'root' })
export class ShellPresence {
  private readonly count = signal(0);
  readonly present = () => this.count() > 0;

  enter(destroyRef: DestroyRef): void {
    this.count.update((n) => n + 1);
    destroyRef.onDestroy(() => this.count.update((n) => n - 1));
  }
}

/**
 * The offline banner (L2-048 AC4) in a live region that is always present, so it is announced when it appears.
 * A shell renders it directly under its top bar, as the mocks place it (docs/mocks/pages/offline); pages without a
 * shell, such as sign in, show it at the top of the page.
 */
@Component({
  selector: 'ft-offline-banner',
  imports: [BannerComponent],
  templateUrl: './offline-banner.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfflineBannerComponent {
  protected readonly connectivity = inject(ConnectivityService);
}
