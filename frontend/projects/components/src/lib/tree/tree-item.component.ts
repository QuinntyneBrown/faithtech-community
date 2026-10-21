import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  input,
  linkedSignal,
} from '@angular/core';
import { BadgeComponent, BadgeVariant } from '../badge/badge.component';

let nextId = 0;

/**
 * One tree node: kind badge, label (a link when `href` is set) and meta. A node with nested
 * `ft-tree-item`s gets a disclosure button (`aria-expanded`, `aria-controls`) before the badge,
 * named "Contents of <label>", that shows or hides the children. The title link sits beside the
 * button, never inside it, so no control is nested in another.
 */
@Component({
  selector: 'ft-tree-item',
  imports: [BadgeComponent],
  templateUrl: './tree-item.component.html',
  styleUrl: './tree-item.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'listitem' },
})
export class TreeItemComponent {
  readonly label = input.required<string>();
  readonly kind = input<string | null>(null);
  readonly kindVariant = input<BadgeVariant>('role');
  readonly meta = input<string | null>(null);
  readonly href = input<string | null>(null);
  /** Initial open state of a node with children. */
  readonly expanded = input(false);

  /** Whether the children are shown; starts from `expanded`, then follows the toggle. */
  protected readonly open = linkedSignal(() => this.expanded());
  protected readonly childrenId = `ft-tree-item-children-${nextId++}`;

  private readonly children = contentChildren(TreeItemComponent);
  protected readonly hasChildren = computed(() => this.children().length > 0);
}
