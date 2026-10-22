import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import {
  PARTNERS_SERVICE,
  PARTNER_ACTIVITY_LABELS,
  PARTNER_STAGE_LABELS,
  PartnerActivityDto,
  PartnerDto,
  PartnerDuplicateDto,
  PartnerStage,
} from '@faithtech-community/api';
import {
  AlertComponent,
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
  MergePartnersData,
  MergePartnersDialog,
  MovePartnerData,
  MovePartnerDialog,
  RestorePartnerData,
  RestorePartnerDialog,
} from '../../dialogs';
import { PartnerTimelineComponent, localDate } from './partner-timeline';

type State = 'loading' | 'loaded' | 'not-found' | 'error';

/** Ends a sentence with a full stop, unless it already ends with one (“Kestrel Labs Inc.”). */
function sentence(text: string): string {
  return text.endsWith('.') ? text : `${text}.`;
}

/** Stage badges as the mocks colour them. */
export const STAGE_BADGES: Record<PartnerStage, BadgeVariant> = {
  Lead: 'neutral',
  InFunnel: 'warning',
  Confirmed: 'success',
};

/**
 * One partner with its details and shared activity timeline (L2-017, L2-018, L2-086), matching
 * docs/mocks/pages/partner. Log activity opens LogActivityDialog for leads and System Admin. A
 * possible duplicate shows a warning with Compare and merge, Open {other} and Not the same
 * (L2-088, L2-089); an archived (merged) partner shows who merged it instead, read-only.
 */
@Component({
  selector: 'ft-partner-page',
  imports: [
    AlertComponent,
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
  /** Undismissed possible duplicates, by name; the first takes the alert (L2-088). */
  protected readonly duplicates = signal<PartnerDuplicateDto[]>([]);
  protected readonly duplicate = computed(() => this.duplicates()[0] ?? null);
  protected readonly dismissing = signal(false);
  private readonly header = viewChild(PageHeaderComponent);

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

  protected duplicateHeading(match: PartnerDuplicateDto): string {
    const more = this.duplicates().length - 1;
    return `This may be the same partner as “${match.name}”${more > 0 ? ` and ${more} more` : ''}`;
  }

  /** Compare and merge: reads the duplicate, then this page's partner is the kept record (L2-089). */
  protected async compareAndMerge(partner: PartnerDto, match: PartnerDuplicateDto): Promise<void> {
    let other: PartnerDto;
    try {
      other = await firstValueFrom(this.partners.get(match.id));
    } catch {
      this.toasts.show({
        variant: 'danger',
        heading: `Couldn’t open ${match.name} to compare. Try again.`,
      });
      return;
    }
    const ref = this.dialogs.open<PartnerDto, MergePartnersData>(MergePartnersDialog, {
      data: { kept: partner, other, match },
    });
    const merged = await firstValueFrom(ref.closed);
    if (!merged) return;
    this.partner.set(merged);
    this.timelineReload.update((n) => n + 1);
    void this.loadDuplicates(merged.id);
    this.toasts.show({
      variant: 'success',
      heading: `Merged ${other.name} into ${merged.name}`,
      text: sentence(`Both timelines are here now. A System Admin can restore ${other.name}`),
    });
  }

  /** System Admin only: the partner becomes active again with its own entries (L2-090 AC4). */
  protected async restore(partner: PartnerDto): Promise<void> {
    const ref = this.dialogs.open<PartnerDto, RestorePartnerData>(RestorePartnerDialog, {
      data: { partner },
    });
    const restored = await firstValueFrom(ref.closed);
    if (!restored) return;
    this.partner.set(restored);
    void this.loadDuplicates(restored.id);
    this.toasts.show({
      variant: 'success',
      heading: `${restored.name} restored`,
      text: `It’s back on the board at ${this.labels[restored.stage]} with its own entries.`,
    });
  }

  /** "{merged by} merged it on {day}. Its activity and stage history are on {kept}." */
  protected archivedText(partner: PartnerDto): string {
    const archived = partner.archived!;
    const day = formatDay(new Date(archived.mergedAtUtc));
    return sentence(
      `${archived.mergedByName} merged it on ${day}. Its activity and stage history are on ${archived.mergedIntoName}`,
    );
  }

  /** "{added by} added {other} on {day} with the same {website|name}, {matched on}." */
  protected duplicateAdded(match: PartnerDuplicateDto): string | null {
    if (!match.addedByName || !match.addedOn) return null;
    const what = match.reason === 'Website' ? 'website' : 'name';
    return sentence(
      `${match.addedByName} added ${match.name} on ${this.localDay(match.addedOn)} with the same ${what}, ${match.matchedOn}`,
    );
  }

  /** "Not the same": the pair is dismissed for every lead and the next match, if any, takes the alert. */
  protected async notTheSame(partner: PartnerDto, match: PartnerDuplicateDto): Promise<void> {
    if (this.dismissing()) return;
    this.dismissing.set(true);
    try {
      await firstValueFrom(this.partners.dismissDuplicate(partner.id, match.id));
      await this.loadDuplicates(partner.id);
      // The button that had focus is gone with the alert.
      this.header()?.focusTitle();
      this.toasts.show({
        variant: 'success',
        heading: `Marked ${match.name} as a different partner`,
      });
    } catch {
      this.toasts.show({
        variant: 'danger',
        heading: `Couldn’t mark ${match.name} as a different partner. Try again.`,
      });
    } finally {
      this.dismissing.set(false);
    }
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

  /** Advisory: when the check fails the page shows without the alert. */
  private async loadDuplicates(id: string): Promise<void> {
    try {
      this.duplicates.set((await firstValueFrom(this.partners.duplicates(id))).matches);
    } catch {
      this.duplicates.set([]);
    }
  }

  private async load(id: string): Promise<void> {
    this.state.set('loading');
    this.duplicates.set([]);
    try {
      const partner = await firstValueFrom(this.partners.get(id));
      this.partner.set(partner);
      this.state.set('loaded');
      // An archived partner is never a duplicate (L2-088 AC8).
      if (!partner.archived) void this.loadDuplicates(id);
    } catch (error) {
      this.state.set(
        error instanceof HttpErrorResponse && error.status === 404 ? 'not-found' : 'error',
      );
    }
  }
}
