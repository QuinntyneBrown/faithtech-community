import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Container for label and value facts, such as a contact Details block. Holds `ft-description-list-item`s. */
@Component({
  selector: 'ft-description-list',
  templateUrl: './description-list.component.html',
  styleUrl: './description-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'group' },
})
export class DescriptionListComponent {}
