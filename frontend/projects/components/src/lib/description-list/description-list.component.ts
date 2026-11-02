import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type DescriptionListLayout = 'default' | 'stacked';

/**
 * Container for label and value facts, such as a contact Details block. Holds
 * `ft-description-list-item`s. Set `loading` while the record loads: the list is aria-busy and
 * every item keeps its term with a skeleton line in place of its value. `layout="stacked"` is for a narrow card,
 * such as a process stage's points: the term in default text above a small, muted description, pairs closer together.
 */
@Component({
  selector: 'ft-description-list',
  templateUrl: './description-list.component.html',
  styleUrl: './description-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'group',
    '[attr.aria-busy]': 'loading() ? "true" : null',
    '[class.ft-description-list--stacked]': 'layout() === "stacked"',
  },
})
export class DescriptionListComponent {
  readonly loading = input(false);
  readonly layout = input<DescriptionListLayout>('default');
}
