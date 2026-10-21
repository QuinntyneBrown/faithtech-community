import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  PARTNERS_SERVICE,
  PARTNER_STAGE_LABELS,
  PartnerBoardDto,
  PartnerCardDto,
  PartnerDto,
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
  KanbanColumnComponent,
  PageHeaderComponent,
  SkeletonComponent,
  StackComponent,
  ToastService,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

import { AddPartnerDialog } from '../../dialogs';

type State = 'loading' | 'loaded' | 'error' | 'forbidden';

/** The shared partner pipeline as a Kanban board (L2-017, L2-018), matching docs/mocks/pages/partners. */
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
  private readonly partners = inject(PARTNERS_SERVICE);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);

  protected readonly state = signal<State>('loading');
  protected readonly board = signal<PartnerBoardDto | null>(null);
  protected readonly labels = PARTNER_STAGE_LABELS;

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

  protected caption(card: PartnerCardDto): string {
    return [card.contactName, card.offering].filter(Boolean).join(' · ');
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
  };
}
