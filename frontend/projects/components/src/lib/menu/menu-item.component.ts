import { CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

/**
 * One account-menu item. Put it on a native `<a>` (navigation) or `<button>` (command) inside an
 * `ft-menu`; it is a CDK menuitem with roving focus, an optional icon and the label as content.
 */
@Component({
  selector: 'a[ft-menu-item], button[ft-menu-item]',
  imports: [IconComponent],
  hostDirectives: [
    { directive: CdkMenuItem, inputs: ['cdkMenuItemDisabled: disabled'] },
    // An item may open a submenu, such as the block menu's "Turn into".
    {
      directive: CdkMenuTrigger,
      inputs: ['cdkMenuTriggerFor: submenu', 'cdkMenuTriggerData: submenuData'],
    },
  ],
  templateUrl: './menu-item.component.html',
  styleUrl: './menu-item.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.ft-menu-item--danger]': 'danger()',
    '[attr.aria-keyshortcuts]': 'keyshortcuts()',
  },
})
export class MenuItemComponent {
  readonly icon = input<string | null>(null);
  /** A keyboard shortcut that does the same, shown at the end and exposed as `aria-keyshortcuts`. */
  readonly shortcut = input<string | null>(null);
  /** A destructive item, such as Delete, in the danger colour. */
  readonly danger = input(false);

  protected keyshortcuts(): string | null {
    return this.shortcut()?.replace('↑', 'ArrowUp').replace('↓', 'ArrowDown') ?? null;
  }
}
