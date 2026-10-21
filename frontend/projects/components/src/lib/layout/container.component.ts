import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Page width (max `--layout-container-max`) with the responsive side margins. */
@Component({
  selector: 'ft-container',
  templateUrl: './container.component.html',
  styleUrl: './container.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContainerComponent {}
