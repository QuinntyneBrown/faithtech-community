import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AvatarColor, AvatarComponent, AvatarSize } from '../avatar/avatar.component';

/**
 * A centred avatar, name and one line of meta ("City Lead · Toronto"): who a visitor is connecting
 * with on the connect page (design system: Person summary). The avatar is decorative; the name is text.
 */
@Component({
  selector: 'ft-person-summary',
  imports: [AvatarComponent],
  templateUrl: './person-summary.component.html',
  styleUrl: './person-summary.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonSummaryComponent {
  readonly name = input.required<string>();
  readonly meta = input<string | null>(null);
  readonly photoUrl = input<string | null>(null);
  readonly color = input<AvatarColor>('plain');
  readonly size = input<AvatarSize>('xl');
}
