import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * The row of filters above a report or list (design system, `.filter-bar`): a group named by
 * `label` holding the projected fields and Apply, bottom aligned so the buttons line up with the
 * selects, wrapping on small screens. Project an action such as Export CSV with `ftFilterBarEnd`
 * to push it to the end of the row. Wrap it in the page's `<form>` when Apply submits.
 */
@Component({
  selector: 'ft-filter-bar',
  templateUrl: './filter-bar.component.html',
  styleUrl: './filter-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'group', '[attr.aria-label]': 'label()' },
})
export class FilterBarComponent {
  readonly label = input.required<string>();
}
