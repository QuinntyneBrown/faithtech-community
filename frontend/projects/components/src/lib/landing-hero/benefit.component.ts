import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { IconTileComponent } from '../icon-tile/icon-tile.component';

/** One "Why join" card on the marketing page: icon tile, `<h3>` and a sentence (landing hero). */
@Component({
  selector: 'ft-benefit',
  imports: [IconTileComponent],
  templateUrl: './benefit.component.html',
  styleUrl: './benefit.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BenefitComponent {
  readonly icon = input.required<string>();
  readonly heading = input.required<string>();
}
