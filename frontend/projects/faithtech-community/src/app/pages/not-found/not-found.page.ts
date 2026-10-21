import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ContainerComponent, ErrorPageComponent } from '@faithtech-community/components';

@Component({
  selector: 'ft-not-found-page',
  imports: [ContainerComponent, ErrorPageComponent],
  templateUrl: './not-found.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFoundPage {}
