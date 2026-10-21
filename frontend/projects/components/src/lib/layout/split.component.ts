import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * One column on phones; main and aside at 2:1 from 1024px. Project the columns with the
 * `ftSplitMain` and `ftSplitAside` attributes.
 */
@Component({
  selector: 'ft-split',
  templateUrl: './split.component.html',
  styleUrl: './split.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SplitComponent {}
