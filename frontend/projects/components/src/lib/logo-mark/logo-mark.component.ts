import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * The FaithTech mark tile for the auth screens. Named "FaithTech" by default; pass an empty `label`
 * when a visible brand name sits next to it so the name is not read twice.
 */
@Component({
  selector: 'ft-logo-mark',
  templateUrl: './logo-mark.component.html',
  styleUrl: './logo-mark.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogoMarkComponent {
  readonly label = input('FaithTech');
}
