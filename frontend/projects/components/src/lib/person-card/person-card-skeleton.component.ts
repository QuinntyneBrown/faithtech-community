import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Loading placeholder for a person grid: card-shaped skeletons in a busy status region. */
@Component({
  selector: 'ft-person-card-skeleton',
  templateUrl: './person-card-skeleton.component.html',
  styleUrls: ['./person-grid.component.scss', './person-card-skeleton.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonCardSkeletonComponent {
  readonly label = input.required<string>();
  readonly cards = input(4);

  protected readonly placeholders = computed(() =>
    Array.from({ length: this.cards() }, (_, i) => i),
  );
}
