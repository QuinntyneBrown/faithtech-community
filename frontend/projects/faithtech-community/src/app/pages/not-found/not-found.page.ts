import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ErrorPageComponent } from '@faithtech-community/components';

/** The wildcard route's page (L2-048 AC1), inside the app shell or, signed out, the public shell. */
@Component({
  selector: 'ft-not-found-page',
  imports: [ErrorPageComponent],
  templateUrl: './not-found.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFoundPage {}
