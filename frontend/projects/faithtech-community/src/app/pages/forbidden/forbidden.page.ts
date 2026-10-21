import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ContainerComponent, ErrorPageComponent } from '@faithtech-community/components';

@Component({
  selector: 'ft-forbidden-page',
  imports: [ContainerComponent, ErrorPageComponent],
  templateUrl: './forbidden.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForbiddenPage {}
