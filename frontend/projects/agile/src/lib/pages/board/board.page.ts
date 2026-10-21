import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  AGILE_LIVE_SERVICE,
  AGILE_SERVICE,
  BacklogFilter,
  BacklogNodeDto,
  BoardCardDto,
  BoardDto,
  WorkItemDto,
  WorkItemStatus,
  WorkspaceDto,
} from '@faithtech-community/api';
import {
  AlertComponent,
  ButtonComponent,
  CardComponent,
  DialogService,
  EmptyStateComponent,
  FormFieldComponent,
  IconComponent,
  KanbanBoardComponent,
  KanbanCardComponent,
  KanbanCardDrop,
  KanbanColumnComponent,
  SelectComponent,
  SelectOption,
  SkeletonComponent,
  StatComponent,
  ToastService,
} from '@faithtech-community/components';
import { Subscription, firstValueFrom } from 'rxjs';

import { MoveCardData, MoveCardDialog, WorkItemDialog, WorkItemDialogData } from '../../dialogs';
import {
  STATUS_LABELS,
  calendarDay,
  dateRange,
  firstName,
  flatten,
  points,
} from '../../work-item-labels';
import { WorkspaceFrameComponent } from '../workspace-frame';

type State = 'loading' | 'loaded' | 'error' | 'not-found';

/**
 * The board (L2-034): stories in To Do, In Progress and Done, moved by drag or with the Move button,
 * and kept in step with other viewers over AGILE_LIVE_SERVICE. A Scrum board shows the active sprint.
 * Matches docs/mocks/pages/team-board.
 */
@Component({
  selector: 'ft-board-page',
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    ButtonComponent,
    CardComponent,
    EmptyStateComponent,
    FormFieldComponent,
    IconComponent,
    KanbanBoardComponent,
    KanbanCardComponent,
    KanbanColumnComponent,
    SelectComponent,
    SkeletonComponent,
    StatComponent,
    WorkspaceFrameComponent,
  ],
  templateUrl: './board.page.html',
  styleUrl: './board.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BoardPage {
  private readonly agile = inject(AGILE_SERVICE);
  private readonly live = inject(AGILE_LIVE_SERVICE);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private watching: Subscription | null = null;

  readonly id = input.required<string>();

  protected readonly state = signal<State>('loading');
  protected readonly workspace = signal<WorkspaceDto | null>(null);
  protected readonly board = signal<BoardDto | null>(null);
  protected readonly announcement = signal('');
  protected readonly labels = STATUS_LABELS;
  protected readonly filter = new FormControl('', { nonNullable: true });
  private readonly planning = signal<BacklogNodeDto[]>([]);

  protected readonly scrum = computed(() => this.board()?.method === 'Scrum');
  protected readonly ownerFirstName = computed(() => firstName(this.workspace()?.ownerName ?? ''));
  protected readonly isMember = computed(() => this.workspace()?.access === 'Member');
  protected readonly subtitle = computed(() => {
    const board = this.board();
    if (!board) return null;
    if (board.method === 'Kanban') return 'Kanban · To Do → In Progress → Done';
    const sprint = board.sprint;
    return sprint
      ? `Scrum · ${sprint.name} · ${dateRange(sprint.startDate, sprint.endDate)}`
      : 'Scrum · no active sprint';
  });
  protected readonly filterOptions = computed<SelectOption[]>(() => [
    { value: '', label: 'All initiatives and epics' },
    ...this.planning().map((n) => ({
      value: `${n.kind === 'Initiative' ? 'initiativeId' : 'epicId'}:${n.id}`,
      label: `${n.kind}: ${n.title}`,
    })),
    { value: 'noEpic', label: 'No epic' },
  ]);

  constructor() {
    effect(() => void this.load(this.id()));
    this.filter.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => void this.loadBoard());
  }

  protected caption(card: BoardCardDto): string {
    return [
      firstName(card.assigneeName),
      points(card.storyPoints),
      `${card.tasksDone}/${card.tasksTotal} tasks`,
    ]
      .filter(Boolean)
      .join(' · ');
  }

  protected href(card: BoardCardDto): string {
    return `/workspaces/${this.id()}/items/${card.id}`;
  }

  protected day(date: string): string {
    return calendarDay(date);
  }

  protected retry(): void {
    void this.load(this.id());
  }

  protected async dropped(drop: KanbanCardDrop): Promise<void> {
    const card = this.find(drop.cardId as string);
    if (!card || drop.from === drop.to) return;
    const to = drop.to as WorkItemStatus;
    this.place(card.id, to);
    try {
      await firstValueFrom(this.agile.moveCard(card.id, to));
      this.announcement.set(`${card.title} moved to ${STATUS_LABELS[to]}`);
    } catch {
      this.toasts.show({ variant: 'danger', heading: 'That didn’t work', text: 'Try again.' });
      await this.loadBoard();
    }
  }

  protected async moveWithDialog(cardId: unknown): Promise<void> {
    const card = this.find(cardId as string);
    const status = this.statusOf(cardId as string);
    if (!card || !status) return;
    const ref = this.dialogs.open<WorkItemStatus, MoveCardData>(MoveCardDialog, {
      data: { itemId: card.id, title: card.title, status },
    });
    const moved = await firstValueFrom(ref.closed);
    if (!moved) return;
    this.place(card.id, moved);
    this.announcement.set(`${card.title} moved to ${STATUS_LABELS[moved]}`);
  }

  protected async newStory(): Promise<void> {
    const workspace = this.workspace();
    if (!workspace) return;
    const ref = this.dialogs.open<WorkItemDto | true, WorkItemDialogData>(WorkItemDialog, {
      data: { workspace, kind: 'Story' },
    });
    const created = await firstValueFrom(ref.closed);
    if (!created || created === true) return;
    this.toasts.show({ variant: 'success', heading: `${created.title} created` });
    await this.loadBoard();
  }

  private find(cardId: string): BoardCardDto | undefined {
    return this.board()
      ?.columns.flatMap((c) => c.cards)
      .find((c) => c.id === cardId);
  }

  private statusOf(cardId: string): WorkItemStatus | undefined {
    return this.board()?.columns.find((c) => c.cards.some((card) => card.id === cardId))?.status;
  }

  /** Moves the card at once so the board answers the drop; the server and other viewers follow. */
  private place(cardId: string, to: WorkItemStatus): void {
    this.board.update((board) => {
      if (!board) return board;
      const card = board.columns.flatMap((c) => c.cards).find((c) => c.id === cardId);
      if (!card) return board;
      return {
        ...board,
        columns: board.columns.map((c) => ({
          ...c,
          cards:
            c.status === to
              ? [...c.cards.filter((x) => x.id !== cardId), card]
              : c.cards.filter((x) => x.id !== cardId),
        })),
      };
    });
  }

  private async load(id: string): Promise<void> {
    this.state.set('loading');
    this.watching?.unsubscribe();
    try {
      this.workspace.set(await firstValueFrom(this.agile.getWorkspace(id)));
      const all = await firstValueFrom(this.agile.getBacklog(id));
      this.planning.set(flatten(all).filter((n) => n.kind === 'Initiative' || n.kind === 'Epic'));
      await this.loadBoard();
      this.watch(id);
    } catch (error) {
      this.state.set(
        error instanceof HttpErrorResponse && error.status === 404 ? 'not-found' : 'error',
      );
    }
  }

  /** Other viewers' moves, and a reload after the connection comes back (L2-034 AC2). */
  private watch(id: string): void {
    this.watching = this.live
      .watchBoard(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => void this.loadBoard(),
        // Live updates are an enhancement; the board still works without them.
        error: () => undefined,
      });
  }

  private async loadBoard(): Promise<void> {
    try {
      this.board.set(await firstValueFrom(this.agile.getBoard(this.id(), this.chosenFilter())));
      this.state.set('loaded');
    } catch {
      this.state.set('error');
    }
  }

  private chosenFilter(): BacklogFilter {
    const value = this.filter.value;
    if (value === 'noEpic') return { noEpic: true };
    const [key, id] = value.split(':');
    if (key === 'initiativeId') return { initiativeId: id };
    if (key === 'epicId') return { epicId: id };
    return {};
  }
}
