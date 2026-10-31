import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  OrganisationNames,
  PartnerBoardDto,
  PartnerCardDto,
  PartnerColumnDto,
  PartnerDto,
  PARTNERS_SERVICE,
  PartnerStage,
} from '@faithtech-community/api';
import {
  AlertComponent,
  ButtonComponent,
  CardComponent,
  DialogService,
  EmptyStateComponent,
  IconComponent,
  KanbanBoardComponent,
  KanbanCardComponent,
  KanbanCardDrop,
  KanbanColumnComponent,
  PageHeaderComponent,
  SkeletonComponent,
  StackComponent,
  ToastService,
  formatDay,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

import { AddPartnerDialog, MovePartnerData, MovePartnerDialog } from '../../dialogs';
import { localDate } from '../partner/partner-timeline';

type State = 'loading' | 'loaded' | 'error' | 'forbidden';

/**
 * The shared partner pipeline as a Kanban board (L2-017, L2-018), matching docs/mocks/pages/partners: one column per
 * active stage of the organisation, then "Archived stage: {name}" for an archived stage that still holds partners,
 * which cards may leave but not enter (L2-144 AC3, AC4).
 */
@Component({
  selector: 'ft-partners-page',
  imports: [
    AlertComponent,
    ButtonComponent,
    CardComponent,
    EmptyStateComponent,
    IconComponent,
    KanbanBoardComponent,
    KanbanCardComponent,
    KanbanColumnComponent,
    PageHeaderComponent,
    SkeletonComponent,
    StackComponent,
  ],
  templateUrl: './partners.page.html',
  styleUrl: './partners.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartnersPage {
  protected readonly organisation = inject(OrganisationNames);
  private readonly partners = inject(PARTNERS_SERVICE);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);

  protected readonly state = signal<State>('loading');
  protected readonly board = signal<PartnerBoardDto | null>(null);
  /** Read out after each move (L2-018 AC3). */
  protected readonly announcement = signal('');

  protected readonly total = computed(
    () => this.board()?.columns.reduce((sum, c) => sum + c.count, 0) ?? 0,
  );
  protected readonly subtitle = computed(() => {
    const total = this.total();
    if (!total) return 'Shared by every lead';
    return `Shared by every lead · ${total} ${total === 1 ? 'partner' : 'partners'}`;
  });

  constructor() {
    void this.load();
  }

  protected title(column: PartnerColumnDto): string {
    return column.archived ? `Archived stage: ${column.name}` : column.name;
  }

  protected caption(card: PartnerCardDto): string {
    return [card.contactName, card.offering].filter(Boolean).join(' · ');
  }

  /** "Next: Send credit-line wording · Wed 22 Oct" when the partner has a next step (L2-111 AC6). */
  protected detail(card: PartnerCardDto): string | null {
    if (!card.nextStep) return null;
    const due = card.nextStepDue ? ` · ${formatDay(localDate(card.nextStepDue))}` : '';
    return `Next: ${card.nextStep}${due}`;
  }

  protected retry(): void {
    void this.load();
  }

  protected async addPartner(): Promise<void> {
    const ref = this.dialogs.open<PartnerDto>(AddPartnerDialog, {});
    const created = await firstValueFrom(ref.closed);
    if (!created) return;
    this.board.update((board) =>
      board
        ? {
            ...board,
            columns: board.columns.map((column) =>
              column.stage === created.stage
                ? {
                    ...column,
                    count: column.count + 1,
                    cards: [...column.cards, toCard(created)].sort((a, b) =>
                      a.name.localeCompare(b.name),
                    ),
                  }
                : column,
            ),
          }
        : board,
    );
    this.toasts.show({ variant: 'success', heading: `${created.name} added to the pipeline` });
  }

  /** The Move button: the keyboard and screen-reader path (WCAG 2.5.7). */
  protected async moveWithDialog(card: PartnerCardDto, stage: PartnerStage): Promise<void> {
    const ref = this.dialogs.open<PartnerDto, MovePartnerData>(MovePartnerDialog, {
      data: { partnerId: card.id, name: card.name, stage },
    });
    const moved = await firstValueFrom(ref.closed);
    if (moved) this.place(moved);
  }

  /** A card dragged to another column moves at once; on failure it stays where it was. */
  protected async dropped(drop: KanbanCardDrop): Promise<void> {
    const id = drop.cardId as string;
    try {
      this.place(await firstValueFrom(this.partners.move(id, drop.to as PartnerStage)));
    } catch {
      this.toasts.show({
        variant: 'danger',
        heading: 'Partner not moved',
        text: `We couldn’t reach ${this.organisation.shortName()}, so the partner stays where it was. Try again.`,
      });
    }
  }

  /** Puts a moved partner in its new column and announces the move. */
  private place(moved: PartnerDto): void {
    this.board.update((board) =>
      board
        ? {
            ...board,
            columns: board.columns
              .map((column) => {
                const cards = column.cards.filter((c) => c.id !== moved.id);
                if (column.stage === moved.stage) {
                  cards.push(toCard(moved));
                  cards.sort((a, b) => a.name.localeCompare(b.name));
                }
                return { ...column, count: cards.length, cards };
              })
              // An archived stage's column stays only while it holds partners.
              .filter((column) => !column.archived || column.count > 0),
          }
        : board,
    );
    this.announcement.set(`${moved.name} moved to ${moved.stageName}`);
  }

  private async load(): Promise<void> {
    this.state.set('loading');
    try {
      this.board.set(await firstValueFrom(this.partners.getBoard()));
      this.state.set('loaded');
    } catch (error) {
      this.state.set(
        error instanceof HttpErrorResponse && error.status === 403 ? 'forbidden' : 'error',
      );
    }
  }
}

function toCard(partner: PartnerDto): PartnerCardDto {
  return {
    id: partner.id,
    name: partner.name,
    contactName: partner.contactName,
    offering: partner.offering,
    nextStep: partner.nextStep,
    nextStepDue: partner.nextStepDue,
  };
}
