import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Hierarchy of `ft-tree-item`s, such as a backlog. Items with children are native disclosures. */
@Component({
  selector: 'ft-tree',
  templateUrl: './tree.component.html',
  styleUrl: './tree.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'list', '[attr.aria-label]': 'label()' },
})
export class TreeComponent {
  readonly label = input.required<string>();
}
