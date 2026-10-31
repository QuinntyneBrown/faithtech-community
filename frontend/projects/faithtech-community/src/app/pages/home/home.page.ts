import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  ACTIVITY_SERVICE,
  ActivityItemDto,
  AUTH_SERVICE,
  canManageEvents,
  EVENTS_SERVICE,
  EventSummaryDto,
  ORGANISATION_SERVICE,
  OrganisationNames,
  PARTNERS_SERVICE,
  hasAny,
} from '@faithtech-community/api';
import {
  AlertComponent,
  ButtonComponent,
  CardComponent,
  CardFooterComponent,
  ClusterComponent,
  EmptyStateComponent,
  EventCardComponent,
  EventVisibility,
  FeedComponent,
  FeedItemComponent,
  FeedState,
  GridComponent,
  IconComponent,
  LinkComponent,
  ListComponent,
  ListSkeletonComponent,
  PageHeaderComponent,
  SkeletonComponent,
  SplitComponent,
  StackComponent,
  StatComponent,
  formatDayRange,
  formatFeedTime,
  formatMonth,
  formatTime,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

type Load = 'loading' | 'loaded' | 'error';

interface EventRow {
  id: string;
  title: string;
  month: string;
  day: string;
  meta: string;
  visibility: EventVisibility;
}

interface StatRow {
  label: string;
  count: number;
}

interface FeedRow {
  id: string;
  text: string;
  href: string;
  meta: string;
}

/** Coming up shows the next three events (docs/mocks/pages/home). */
const COMING_UP = 3;
const LONG_DATE = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/**
 * Home at / (L2-049, ADR 0016): the greeting, Coming up, the partner pipeline and recent activity,
 * each loaded on its own so one failure leaves the rest in place. A member with no role sees how
 * to get started instead.
 */
@Component({
  selector: 'ft-home-page',
  imports: [
    NgTemplateOutlet,
    AlertComponent,
    ButtonComponent,
    CardComponent,
    CardFooterComponent,
    ClusterComponent,
    EmptyStateComponent,
    EventCardComponent,
    FeedComponent,
    FeedItemComponent,
    GridComponent,
    IconComponent,
    LinkComponent,
    ListComponent,
    ListSkeletonComponent,
    PageHeaderComponent,
    SkeletonComponent,
    SplitComponent,
    StackComponent,
    StatComponent,
  ],
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage {
  protected readonly organisation = inject(OrganisationNames);
  private readonly auth = inject(AUTH_SERVICE);
  private readonly events = inject(EVENTS_SERVICE);
  private readonly partners = inject(PARTNERS_SERVICE);
  private readonly settings = inject(ORGANISATION_SERVICE);
  private readonly activity = inject(ACTIVITY_SERVICE);

  /** Notifications carry no actor yet (PR #335), so the organisation speaks for them. */
  protected readonly actor = computed(() => this.organisation.name());
  private readonly capabilities = this.auth.capabilities;
  private readonly heldRoles = computed(() => this.auth.currentUser()?.roles ?? []);
  private readonly firstName = computed(
    () => (this.auth.currentUser()?.name ?? '').trim().split(/\s+/)[0] ?? '',
  );

  protected readonly hasRole = computed(() => this.heldRoles().length > 0);
  protected readonly canCreateEvents = computed(() => canManageEvents(this.capabilities()));
  protected readonly canAddContacts = computed(() => hasAny(this.capabilities(), 'KeepContacts'));
  /** The oversight role the banner names, while the member holds nothing that writes (L2-135 AC7). */
  protected readonly oversightRole = computed(() =>
    this.canCreateEvents() || this.canAddContacts()
      ? null
      : (this.heldRoles().find((r) => r.isOversight)?.name ?? null),
  );
  protected readonly isStaffOnly = computed(() => this.oversightRole() !== null);
  /** ViewPartners or ManagePartners open the pipeline (ADR 0009). */
  protected readonly seesPipeline = computed(() =>
    hasAny(this.capabilities(), 'ViewPartners', 'ManagePartners'),
  );

  protected readonly title = computed(() => {
    const name = this.firstName();
    if (!this.hasRole()) return name ? `Welcome, ${name}` : 'Welcome';
    const greeting = greetingFor(new Date());
    return name ? `${greeting}, ${name}` : greeting;
  });

  protected readonly eventsState = signal<Load>('loading');
  protected readonly comingUp = signal<EventRow[]>([]);
  private readonly upcomingCount = signal(0);
  protected readonly subtitle = computed(() => {
    const today = LONG_DATE.format(new Date()).replace(',', '');
    const count = this.upcomingCount();
    const coming =
      count === 0
        ? 'No events coming up'
        : `${count} ${count === 1 ? 'event' : 'events'} coming up`;
    return `${today} · ${coming}`;
  });

  protected readonly pipelineState = signal<Load>('loading');
  /** One count per active stage of the organisation, in its order (L2-144 AC5). */
  protected readonly stats = signal<StatRow[]>([]);
  protected readonly noPartners = computed(() => this.stats().every((s) => s.count === 0));
  protected readonly retryingPipeline = signal(false);

  protected readonly feedState = signal<FeedState>('loading');
  protected readonly feed = signal<FeedRow[]>([]);
  protected readonly retryingFeed = signal(false);

  constructor() {
    this.loadAll();
  }

  protected retryPage(): void {
    this.loadAll();
  }

  protected async retryPipeline(): Promise<void> {
    this.retryingPipeline.set(true);
    await this.loadPipeline(false);
    this.retryingPipeline.set(false);
  }

  protected async retryFeed(): Promise<void> {
    this.retryingFeed.set(true);
    await this.loadFeed(false);
    this.retryingFeed.set(false);
  }

  private loadAll(): void {
    if (this.hasRole()) {
      void this.loadEvents();
      if (this.seesPipeline()) void this.loadPipeline();
    }
    void this.loadFeed();
  }

  private async loadEvents(): Promise<void> {
    this.eventsState.set('loading');
    try {
      const list = await firstValueFrom(this.events.listEvents({ filter: 'Upcoming' }));
      const upcoming = list.events.filter((e) => !e.isCancelled);
      this.upcomingCount.set(upcoming.length);
      this.comingUp.set(
        upcoming
          .slice(0, COMING_UP)
          .map((e) => toRow(e, this.organisation.chapterPlace(e.chapterName))),
      );
      this.eventsState.set('loaded');
    } catch {
      this.eventsState.set('error');
    }
  }

  private async loadPipeline(showSkeleton = true): Promise<void> {
    if (showSkeleton) {
      this.pipelineState.set('loading');
      // The skeleton names the organisation's stages until the board's counts arrive.
      this.settings.get().subscribe({
        next: (o) => {
          if (this.pipelineState() === 'loading')
            this.stats.set(o.partnerStages.map((s) => ({ label: s.name, count: 0 })));
        },
        error: () => undefined,
      });
    }
    try {
      const board = await firstValueFrom(this.partners.getBoard());
      this.stats.set(
        board.columns.filter((c) => !c.archived).map((c) => ({ label: c.name, count: c.count })),
      );
      this.pipelineState.set('loaded');
    } catch {
      this.pipelineState.set('error');
    }
  }

  private async loadFeed(showSkeleton = true): Promise<void> {
    if (showSkeleton) this.feedState.set('loading');
    try {
      const items = await firstValueFrom(this.activity.recent());
      this.feed.set(items.map(toFeedRow));
      this.feedState.set(items.length === 0 ? 'empty' : 'ready');
    } catch {
      this.feedState.set('error');
    }
  }
}

function greetingFor(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/** "Fri 6 Nov · 6:30 pm · Kestrel Labs, 220 King St W · 34 going", as the home mock words it. */
function toRow(event: EventSummaryDto, chapter: string | null): EventRow {
  const start = new Date(event.startsAt);
  const oneDay = start.toDateString() === new Date(event.endsAt).toDateString();
  const place = event.format === 'Online' ? 'Online' : (event.venue ?? chapter);
  const meta = [
    formatDayRange(event.startsAt, event.endsAt),
    oneDay ? formatTime(start) : null,
    place,
    event.rsvpCount > 0 ? `${event.rsvpCount} going` : null,
  ]
    .filter((part): part is string => !!part)
    .join(' · ');
  return {
    id: event.id,
    title: event.title,
    month: formatMonth(start),
    day: String(start.getDate()),
    meta,
    visibility: event.visibility === 'Public' ? 'public' : 'members',
  };
}

function toFeedRow(item: ActivityItemDto): FeedRow {
  return {
    id: item.id,
    text: item.text,
    href: item.linkPath,
    meta: formatFeedTime(item.occurredAt),
  };
}
