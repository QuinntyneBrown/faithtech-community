import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ErrorPageComponent } from '@faithtech-community/components';

/** Shown by httpErrorInterceptor on a 403 (L2-048 AC2), inside the shell the visitor is in. */
@Component({
  selector: 'ft-forbidden-page',
  imports: [ErrorPageComponent],
  templateUrl: './forbidden.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForbiddenPage {}
