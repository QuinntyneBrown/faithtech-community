import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { AvatarColor, AvatarComponent } from '../avatar/avatar.component';
import { BadgeComponent, BadgeVariant } from '../badge/badge.component';
import { IconComponent } from '../icon/icon.component';

export interface SearchResultItem {
  title: string;
  href: string;
  /** For example "Volunteer · Toronto · led the shelter intake team". */
  meta?: string;
  /** Shows initials in an avatar when set. */
  avatarName?: string;
  avatarColor?: AvatarColor;
  /** Shows a decorative icon tile for non-person results, e.g. "workspaces" for a work item. */
  icon?: string;
  badge?: string;
  badgeVariant?: BadgeVariant;
}

export interface SearchGroup {
  id: string;
  /** Type name without the count, for example "People". */
  title: string;
  items: SearchResultItem[];
  /** A link after the group, such as "See all in Resources". */
  more?: { label: string; href: string };
}

interface Segment {
  text: string;
  match: boolean;
}

interface ViewItem extends SearchResultItem {
  titleSegments: Segment[];
  metaSegments: Segment[];
}

interface ViewGroup {
  id: string;
  heading: string;
  items: ViewItem[];
  more?: { label: string; href: string };
}

function segments(text: string, query: string): Segment[] {
  const terms = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (terms.length === 0 || !text) return [{ text, match: false }];
  const pattern = new RegExp(`(${terms.join('|')})`, 'gi');
  return text
    .split(pattern)
    .map((part, i) => ({ text: part, match: i % 2 === 1 }))
    .filter((s) => s.text !== '');
}

/**
 * Global search results grouped by type. Each non-empty group is a labelled section with an
 * overline heading and count; matched words are wrapped in `<mark>`. The count is announced in a
 * status line. The server decides which groups a person gets; empty groups are left out.
 */
@Component({
  selector: 'ft-search-results',
  imports: [AvatarComponent, BadgeComponent, IconComponent],
  templateUrl: './search-results.component.html',
  styleUrl: './search-results.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchResultsComponent {
  readonly query = input('');
  readonly groups = input<SearchGroup[]>([]);

  protected readonly view = computed<ViewGroup[]>(() =>
    this.groups()
      .filter((g) => g.items.length > 0)
      .map((g) => ({
        id: g.id,
        heading: `${g.title} (${g.items.length})`,
        more: g.more,
        items: g.items.map((item) => ({
          ...item,
          titleSegments: segments(item.title, this.query()),
          metaSegments: segments(item.meta ?? '', this.query()),
        })),
      })),
  );

  protected readonly total = computed(() =>
    this.view().reduce((sum, g) => sum + g.items.length, 0),
  );

  protected readonly status = computed(
    () => `${this.total()} ${this.total() === 1 ? 'result' : 'results'} for “${this.query()}”`,
  );
}
