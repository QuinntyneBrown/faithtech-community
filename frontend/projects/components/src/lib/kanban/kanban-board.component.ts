import { CdkDropListGroup } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Kanban board: lays ft-kanban-column elements out by stage (one column on phones, three from
 * 768px; every workflow has three stages) and connects them so cards can be dragged between columns. Dragging is an enhancement only: every card also
 * has a Move button (ft-kanban-card `moveRequested`), the keyboard and screen-reader path.
 * Set `announcement` after a move so it is read out politely ("Kestrel Labs moved to Confirmed").
 */
@Component({
  selector: 'ft-kanban-board',
  templateUrl: './kanban-board.component.html',
  styleUrl: './kanban-board.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [CdkDropListGroup],
})
export class KanbanBoardComponent {
  /** Accessible name of the board region, for example "Partner pipeline". */
  readonly label = input.required<string>();
  readonly announcement = input('');
}
