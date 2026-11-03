import { ChangeDetectionStrategy, Component, Injectable, inject } from '@angular/core';
import { ErrorPageComponent } from '@faithtech-community/components';

/** The page that could not load offline, kept by the app's navigation error handler for Try again. */
@Injectable({ providedIn: 'root' })
export class OfflineRetry {
  url: string | null = null;
}

/**
 * The full offline page (L2-048 AC4): shown in place of a page that could not load while the browser was offline.
 * Try again loads that page afresh, because the browser remembers a failed download of its code until a reload.
 */
@Component({
  selector: 'ft-offline-page',
  imports: [ErrorPageComponent],
  templateUrl: './offline.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfflinePage {
  private readonly pending = inject(OfflineRetry);

  protected retry(): void {
    if (this.pending.url) window.location.assign(this.pending.url);
    else window.location.reload();
  }
}
