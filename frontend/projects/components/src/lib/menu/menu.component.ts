import { CdkMenu, CdkMenuTrigger } from '@angular/cdk/menu';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MenuItemComponent } from './menu-item.component';

export type MenuEntry =
  /** `id` lets the items of a group (such as "Switch organisation") name it with `describedBy`. */
  | { kind: 'header'; title: string; caption?: string; id?: string }
  | { kind: 'divider' }
  | {
      kind: 'item';
      id: string;
      label: string;
      icon?: string;
      href?: string;
      disabled?: boolean;
      /** A second, muted line under the label, such as an organisation's host. */
      caption?: string;
      /** The id of the header of the group the item belongs to. */
      describedBy?: string;
      /** One choice of a group, such as "Counts as": a menuitemradio, checked or not. */
      checked?: boolean;
      /** A destructive item, such as Archive, in the danger colour. */
      danger?: boolean;
    };

/**
 * Account-style menu button (APG Menu Button) on the CDK Menu. The projected content is the
 * trigger face (an avatar, say); `entries` describe the header, dividers and items.
 */
@Component({
  selector: 'ft-menu',
  imports: [CdkMenu, CdkMenuTrigger, MenuItemComponent],
  templateUrl: './menu.component.html',
  styleUrl: './menu.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenuComponent {
  /** Names whose menu this is, for the trigger and the menu ("Account menu for Grace Okonkwo"). */
  readonly label = input.required<string>();
  readonly entries = input<MenuEntry[]>([]);
  readonly itemSelected = output<string>();

  protected readonly positions = [
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 4 },
  ] as const;
}
