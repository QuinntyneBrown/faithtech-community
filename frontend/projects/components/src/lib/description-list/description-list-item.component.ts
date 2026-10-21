import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** One term and its definition. The value is projected so it can hold links or badges. */
@Component({
  selector: 'ft-description-list-item',
  templateUrl: './description-list-item.component.html',
  styleUrl: './description-list-item.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DescriptionListItemComponent {
  readonly label = input.required<string>();
}
