import { CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  OnInit,
} from '@angular/core';
import { BadgeComponent } from '../badge/badge.component';

export interface KanbanCardDrop {
  cardId: unknown;
  /** Stage the card came from. */
  from: unknown;
  /** Stage the card was dropped on. */
  to: unknown;
  index: number;
}

let nextId = 0;

/**
 * One stage of the board: a section labelled by its title, with a count badge and a drop target
 * for cards. The app owns the data: `cardDropped` reports a card dragged to another stage and the
 * app moves it (or leaves it, and the card snaps back).
 */
@Component({
  selector: 'ft-kanban-column',
  imports: [BadgeComponent],
  templateUrl: './kanban-column.component.html',
  styleUrl: './kanban-column.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [CdkDropList],
})
export class KanbanColumnComponent implements OnInit {
  private readonly dropList = inject(CdkDropList);

  readonly title = input.required<string>();
  /** Identifies this stage in `cardDropped`. */
  readonly stage = input.required<unknown>();
  readonly count = input(0);
  readonly emptyText = input('Nothing at this stage yet');

  readonly cardDropped = output<KanbanCardDrop>();

  protected readonly headingId = `ft-kanban-column-${nextId++}`;

  constructor() {
    effect(() => {
      this.dropList.data = this.stage();
    });
    this.dropList.sortingDisabled = true;
  }

  ngOnInit(): void {
    this.dropList.dropped.subscribe((event: CdkDragDrop<unknown>) => {
      if (event.previousContainer === event.container) return;
      this.cardDropped.emit({
        cardId: event.item.data,
        from: event.previousContainer.data,
        to: event.container.data,
        index: event.currentIndex,
      });
    });
  }
}
