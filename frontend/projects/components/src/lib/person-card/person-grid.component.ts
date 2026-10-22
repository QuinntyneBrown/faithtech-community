import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * The grid that holds `ft-person-card`s: one column on phones, two from 640px and four from 1024px, with
 * every card in a row the same height. `label` names the list, such as "Contacts".
 */
@Component({
  selector: 'ft-person-grid',
  templateUrl: './person-grid.component.html',
  styleUrl: './person-grid.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonGridComponent {
  readonly label = input.required<string>();
}
