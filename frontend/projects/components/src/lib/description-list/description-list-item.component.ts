import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { SkeletonComponent } from '../skeleton';
import { DescriptionListComponent } from './description-list.component';

/**
 * One term and its definition. The value is projected so it can hold links or badges.
 * Set `missing` for an optional fact with no value: the row stays and reads "Not added".
 * Inside a loading `ft-description-list` the value is a skeleton line.
 */
@Component({
  selector: 'ft-description-list-item',
  imports: [SkeletonComponent],
  templateUrl: './description-list-item.component.html',
  styleUrl: './description-list-item.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DescriptionListItemComponent {
  private readonly list = inject(DescriptionListComponent, { optional: true });

  readonly label = input.required<string>();
  readonly missing = input(false);

  protected readonly loading = computed(() => this.list?.loading() ?? false);
}
