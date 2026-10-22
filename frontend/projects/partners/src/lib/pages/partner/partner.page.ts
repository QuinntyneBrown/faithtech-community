import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import {
  PARTNERS_SERVICE,
  PARTNER_STAGE_LABELS,
  PartnerDto,
  PartnerStage,
  PartnerStageChangeDto,
} from '@faithtech-community/api';
import {
  BadgeComponent,
  BadgeVariant,
  BreadcrumbComponent,
  BreadcrumbItemComponent,
  ButtonComponent,
  CardComponent,
  DescriptionListComponent,
  DescriptionListItemComponent,
  DialogService,
  EmptyStateComponent,
  FeedComponent,
  FeedItemComponent,
  IconComponent,
  LinkComponent,
  PageHeaderComponent,
  SkeletonComponent,
  SplitComponent,
  StackComponent,
  formatDay,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

import { MovePartnerData, MovePartnerDialog } from '../../dialogs';

type State = 'loading' | 'loaded' | 'not-found' | 'error';

/** Stage badges as the mocks colour them. */
export const STAGE_BADGES: Record<PartnerStage, BadgeVariant> = {
  Lead: 'neutral',
  InFunnel: 'warning',
  Confirmed: 'success',
};

/** One partner with its details and stage history (L2-017, L2-018), matching docs/mocks/pages/partner. */
@Component({
  selector: 'ft-partner-page',
  imports: [
    BadgeComponent,
    BreadcrumbComponent,
    BreadcrumbItemComponent,
    ButtonComponent,
    CardComponent,
    DescriptionListComponent,
    DescriptionListItemComponent,
    EmptyStateComponent,
    FeedComponent,
    FeedItemComponent,
    IconComponent,
    LinkComponent,
    PageHeaderComponent,
    SkeletonComponent,
    SplitComponent,
    StackComponent,
  ],
  templateUrl: './partner.page.html',
  styleUrl: './partner.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartnerPage {
  private readonly partners = inject(PARTNERS_SERVICE);
  private readonly dialogs = inject(DialogService);

  /** Route parameter. */
  readonly id = input.required<string>();

  protected readonly state = signal<State>('loading');
  protected readonly partner = signal<PartnerDto | null>(null);
  protected readonly labels = PARTNER_STAGE_LABELS;
  protected readonly badges = STAGE_BADGES;

  constructor() {
    effect(() => void this.load(this.id()));
  }

  protected moved(partner: PartnerDto, change: PartnerStageChangeDto): string {
    const note = change.note ? `: “${change.note}”` : '';
    return `${change.movedByName} moved ${partner.name} from ${this.labels[change.from]} to ${this.labels[change.to]}${note}`;
  }

  protected day(value: string): string {
    return formatDay(value);
  }

  protected async move(partner: PartnerDto): Promise<void> {
    const ref = this.dialogs.open<PartnerDto, MovePartnerData>(MovePartnerDialog, {
      data: { partnerId: partner.id, name: partner.name, stage: partner.stage },
    });
    const moved = await firstValueFrom(ref.closed);
    if (moved) this.partner.set(moved);
  }

  protected retry(): void {
    void this.load(this.id());
  }

  private async load(id: string): Promise<void> {
    this.state.set('loading');
    try {
      this.partner.set(await firstValueFrom(this.partners.get(id)));
      this.state.set('loaded');
    } catch (error) {
      this.state.set(
        error instanceof HttpErrorResponse && error.status === 404 ? 'not-found' : 'error',
      );
    }
  }
}
