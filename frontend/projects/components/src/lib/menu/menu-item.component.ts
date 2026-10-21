import { CdkMenuItem } from '@angular/cdk/menu';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

/**
 * One account-menu item. Put it on a native `<a>` (navigation) or `<button>` (command) inside an
 * `ft-menu`; it is a CDK menuitem with roving focus, an optional icon and the label as content.
 */
@Component({
  selector: 'a[ft-menu-item], button[ft-menu-item]',
  imports: [IconComponent],
  hostDirectives: [{ directive: CdkMenuItem, inputs: ['cdkMenuItemDisabled: disabled'] }],
  templateUrl: './menu-item.component.html',
  styleUrl: './menu-item.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenuItemComponent {
  readonly icon = input<string | null>(null);
}
