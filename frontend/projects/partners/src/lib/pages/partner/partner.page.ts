import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import {
  PARTNERS_SERVICE,
  PARTNER_ACTIVITY_LABELS,
  PARTNER_STAGE_LABELS,
  PartnerActivityDto,
  PartnerDto,
  PartnerStage,
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
  IconComponent,
  LinkComponent,
  PageHeaderComponent,
  SkeletonComponent,
  SplitComponent,
  StackComponent,
  ToastService,
  formatDay,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

import {
  LogActivityData,
  LogActivityDialog,
  MovePartnerData,
  MovePartnerDialog,
} from '../../dialogs';
import { PartnerTimelineComponent, localDate } from './partner-timeline';

type State = 'loading' | 'loaded' | 'not-found' | 'error';

/** Stage badges as the mocks colour them. */
export const STAGE_BADGES: Record<PartnerStage, BadgeVariant> = {
  Lead: 'neutral',
  InFunnel: 'warning',
  Confirmed: 'success',
};

/**
 * One partner with its details and shared activity timeline (L2-017, L2-018, L2-086), matching
 * docs/mocks/pages/partner. Log activity opens LogActivityDialog for leads and System Admin.
 */
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
    IconComponent,
    LinkComponent,
    PageHeaderComponent,
    PartnerTimelineComponent,
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
  private readonly toasts = inject(ToastService);

  /** Route parameter. */
  readonly id = input.required<string>();

  protected readonly state = signal<State>('loading');
  protected readonly partner = signal<PartnerDto | null>(null);
  protected readonly labels = PARTNER_STAGE_LABELS;
  protected readonly badges = STAGE_BADGES;
  /** Bumped after a log or a move so the timeline fetches its first page again. */
  protected readonly timelineReload = signal(0);

  constructor() {
    effect(() => void this.load(this.id()));
  }

  /** A yyyy-MM-dd date as written, not shifted by the time zone. */
  protected localDay(value: string): string {
    return formatDay(localDate(value));
  }

  protected nextStep(partner: PartnerDto): string {
    const due = partner.nextStepDue ? ` · ${this.localDay(partner.nextStepDue)}` : '';
    return `${partner.nextStep}${due}`;
  }

  protected async move(partner: PartnerDto): Promise<void> {
    const ref = this.dialogs.open<PartnerDto, MovePartnerData>(MovePartnerDialog, {
      data: { partnerId: partner.id, name: partner.name, stage: partner.stage },
    });
    const moved = await firstValueFrom(ref.closed);
    if (moved) {
      this.partner.set(moved);
      this.timelineReload.update((n) => n + 1);
    }
  }

  protected async logActivity(partner: PartnerDto): Promise<void> {
    const ref = this.dialogs.open<PartnerActivityDto, LogActivityData>(LogActivityDialog, {
      data: { partnerId: partner.id, name: partner.name },
    });
    const logged = await firstValueFrom(ref.closed);
    if (!logged) return;
    // Last activity and the next step come from the partner, so read it again with the timeline.
    void this.refresh(partner.id);
    this.toasts.show({
      variant: 'success',
      heading: `${PARTNER_ACTIVITY_LABELS[logged.kind]} logged for ${partner.name}`,
    });
    this.timelineReload.update((n) => n + 1);
  }

  protected retry(): void {
    void this.load(this.id());
  }

  private async refresh(id: string): Promise<void> {
    try {
      this.partner.set(await firstValueFrom(this.partners.get(id)));
    } catch {
      // The page keeps what it showed; the timeline already has the new entry.
    }
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
