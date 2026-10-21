import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  ContainerComponent,
  ErrorPageComponent,
  SkipLinkComponent,
} from '@faithtech-community/components';

@Component({
  selector: 'ft-forbidden-page',
  imports: [SkipLinkComponent, ContainerComponent, ErrorPageComponent],
  templateUrl: './forbidden.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForbiddenPage {}
