import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Container for label and value facts, such as a contact Details block. Holds
 * `ft-description-list-item`s. Set `loading` while the record loads: the list is aria-busy and
 * every item keeps its term with a skeleton line in place of its value.
 */
@Component({
  selector: 'ft-description-list',
  templateUrl: './description-list.component.html',
  styleUrl: './description-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'group', '[attr.aria-busy]': 'loading() ? "true" : null' },
})
export class DescriptionListComponent {
  readonly loading = input(false);
}
