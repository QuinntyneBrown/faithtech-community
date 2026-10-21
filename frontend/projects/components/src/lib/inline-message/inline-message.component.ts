import { ChangeDetectionStrategy, Component } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

/**
 * One line of error text right under the thing it is about. Not a live
 * region: link it to its field with aria-describedby.
 */
@Component({
  selector: 'ft-inline-message',
  imports: [IconComponent],
  templateUrl: './inline-message.component.html',
  styleUrl: './inline-message.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InlineMessageComponent {}
