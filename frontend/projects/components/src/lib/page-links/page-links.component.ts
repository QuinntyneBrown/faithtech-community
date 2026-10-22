import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { IconTileComponent } from '../icon-tile/icon-tile.component';
import { ListComponent } from '../list/list.component';
import { ListItemComponent } from '../list/list-item.component';

/** A page named in a list: its icon and title, and no `id` when the viewer cannot open it ("Private page"). */
export interface PageLinkItem {
  id: string | null;
  title: string;
  icon: string | null;
}

/**
 * "Pages inside" and "Linked from" (design system, page links): a region named by its heading listing pages by
 * icon and title, each a link to `/notes/{id}`, with an empty text and an optional action slot (L2-090 AC5,
 * L2-091 AC2).
 */
@Component({
  selector: 'ft-page-links',
  imports: [IconTileComponent, ListComponent, ListItemComponent],
  templateUrl: './page-links.component.html',
  styleUrl: './page-links.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageLinksComponent {
  readonly heading = input.required<string>();
  readonly pages = input<readonly PageLinkItem[]>([]);
  readonly emptyText = input('');
  /** Where a page opens; the notes app passes `/notes/`. */
  readonly basePath = input('/notes/');
}
