import { CdkDropListGroup } from '@angular/cdk/drag-drop';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  viewChildren,
} from '@angular/core';
import { BadgeComponent } from '../badge/badge.component';
import { BreakpointService } from '../breakpoint/breakpoint.service';
import { KanbanColumnComponent } from './kanban-column.component';

let nextId = 0;

/**
 * Kanban board: lays ft-kanban-column elements out by stage (one column on phones, three from
 * 768px; every workflow has three stages) and connects them so cards can be dragged between columns. Dragging is an enhancement only: every card also
 * has a Move button (ft-kanban-card `moveRequested`), the keyboard and screen-reader path.
 * Set `announcement` after a move so it is read out politely ("Kestrel Labs moved to Confirmed").
 * Below 640px the columns become tabs, one visible at a time (L2-018 AC4, L2-034 AC4).
 */
@Component({
  selector: 'ft-kanban-board',
  imports: [BadgeComponent],
  templateUrl: './kanban-board.component.html',
  styleUrl: './kanban-board.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [CdkDropListGroup],
})
export class KanbanBoardComponent {
  private readonly breakpoint = inject(BreakpointService);

  /** Accessible name of the board region, for example "Partner pipeline". */
  readonly label = input.required<string>();
  readonly announcement = input('');

  protected readonly stages = contentChildren(KanbanColumnComponent);
  protected readonly tabButtons = viewChildren<ElementRef<HTMLButtonElement>>('tab');
  protected readonly phone = computed(() => this.breakpoint.current() === 'base');
  protected readonly selected = signal(0);
  protected readonly tabId = `ft-kanban-tab-${nextId++}`;

  constructor() {
    effect(() => {
      const phone = this.phone();
      const selected = this.selected();
      this.stages().forEach((stage, i) => {
        stage.hiddenOnPhone.set(phone && i !== selected);
        stage.labelledBy.set(phone ? `${this.tabId}-${i}` : null);
      });
    });
  }

  protected select(index: number): void {
    this.selected.set(index);
  }

  protected onKeydown(event: KeyboardEvent, index: number): void {
    const last = this.stages().length - 1;
    const next =
      event.key === 'ArrowRight'
        ? index === last
          ? 0
          : index + 1
        : event.key === 'ArrowLeft'
          ? index === 0
            ? last
            : index - 1
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : null;
    if (next === null) return;
    event.preventDefault();
    this.select(next);
    this.tabButtons()[next]?.nativeElement.focus();
  }
}
