import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ErrorPageComponent } from '@faithtech-community/components';

/** Shown by httpErrorInterceptor on a 500, with the response's correlation ID as the reference. */
@Component({
  selector: 'ft-server-error-page',
  imports: [ErrorPageComponent],
  templateUrl: './server-error.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServerErrorPage {
  protected readonly reference =
    (window.history.state as { referenceId?: string } | null)?.referenceId ?? null;

  protected retry(): void {
    window.history.back();
  }
}
