import { CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  OnInit,
  signal,
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
  host: {
    '[attr.hidden]': 'hiddenOnPhone() ? "" : null',
    '[attr.id]': 'panelId',
    '[attr.role]': 'labelledBy() ? "tabpanel" : null',
    '[attr.aria-labelledby]': 'labelledBy()',
    '[class.ft-kanban__column--closed]': '!droppable()',
  },
})
export class KanbanColumnComponent implements OnInit {
  private readonly dropList = inject(CdkDropList);

  readonly title = input.required<string>();
  /** Identifies this stage in `cardDropped`. */
  readonly stage = input.required<unknown>();
  readonly count = input(0);
  readonly emptyText = input('Nothing at this stage yet');
  /** False for a column cards may leave but not enter, such as an archived stage (L2-144 AC4). */
  readonly droppable = input(true);

  readonly cardDropped = output<KanbanCardDrop>();

  protected readonly headingId = `ft-kanban-column-${nextId}`;
  /** The tab panel id when the board shows its columns as tabs. */
  readonly panelId = `ft-kanban-panel-${nextId++}`;
  /** Set by ft-kanban-board: at XS only the chosen column shows. */
  readonly hiddenOnPhone = signal(false);
  /** Set by ft-kanban-board to its tab's id while the columns are tabs. */
  readonly labelledBy = signal<string | null>(null);

  constructor() {
    effect(() => {
      this.dropList.data = this.stage();
    });
    this.dropList.sortingDisabled = true;
    this.dropList.enterPredicate = () => this.droppable();
  }

  /** Whether a card dragged from another column may be dropped here. */
  acceptsDrops(): boolean {
    return this.dropList.enterPredicate(undefined as never, this.dropList);
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
