import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  input,
} from '@angular/core';
import { BadgeComponent, BadgeVariant } from '../badge/badge.component';

/**
 * One tree node: kind badge, label (a link when `href` is set) and meta. Nested `ft-tree-item`s
 * become children behind a native details/summary disclosure, so the keyboard works for free.
 */
@Component({
  selector: 'ft-tree-item',
  imports: [NgTemplateOutlet, BadgeComponent],
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

  private readonly children = contentChildren(TreeItemComponent);
  protected readonly hasChildren = computed(() => this.children().length > 0);
}
