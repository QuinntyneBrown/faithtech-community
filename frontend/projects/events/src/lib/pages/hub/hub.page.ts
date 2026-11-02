import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import {
  AUTH_SERVICE,
  EVENT_HUBS_SERVICE,
  EventHubDto,
  HubSectionDto,
} from '@faithtech-community/api';
import {
  AlertComponent,
  ButtonComponent,
  CardComponent,
  EmptyStateComponent,
  IconComponent,
  LinkComponent,
  SkeletonComponent,
  StackComponent,
  formatTimeRange,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

import {
  HubAgendaComponent,
  HubGivingComponent,
  HubHeroComponent,
  HubLinksComponent,
  HubPeopleComponent,
  HubParkingComponent,
  HubWhatToBringComponent,
  HubPartnersComponent,
  HubTracksComponent,
  HubProcessComponent,
  HubRulesComponent,
  HubDemoFormatComponent,
  HubJudgingComponent,
  HubWorshipComponent,
  HubSlidesComponent,
  HubUpcomingComponent,
  HubVenueComponent,
  sectionContent,
} from '../../hub-sections';

type State = 'loading' | 'loaded' | 'unavailable' | 'error';

/** How often an open hub reads itself again while its tab is visible (L2-192 AC1, ADR 0044). */
export const HUB_REFRESH_MS = 30_000;

/**
 * The hub page (L2-163, ADR 0039), matching docs/mocks/pages/hub-page: every visible, Ready section in the hub's order with
 * its display component; Upcoming events only when there are some. Read by a holder of ManageEventHubs, it shows under a
 * "Preview" banner; anyone else, or an event without a hub, sees "This hub isn’t available" (anonymous and member
 * reading arrive with slice 44).
 */
@Component({
  selector: 'ft-hub-page',
  imports: [
    AlertComponent,
    ButtonComponent,
    CardComponent,
    EmptyStateComponent,
    HubAgendaComponent,
    HubGivingComponent,
    HubHeroComponent,
    HubLinksComponent,
    HubPeopleComponent,
    HubParkingComponent,
    HubWhatToBringComponent,
    HubPartnersComponent,
    HubTracksComponent,
    HubProcessComponent,
    HubRulesComponent,
    HubDemoFormatComponent,
    HubJudgingComponent,
    HubWorshipComponent,
    HubSlidesComponent,
    HubUpcomingComponent,
    HubVenueComponent,
    IconComponent,
    LinkComponent,
    SkeletonComponent,
    StackComponent,
  ],
  templateUrl: './hub.page.html',
  styleUrl: './hub.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HubPage {
  private readonly hubs = inject(EVENT_HUBS_SERVICE);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  /** Anonymous visitors are offered Sign in when a hub isn't available (L2-166 AC2). */
  protected readonly signedIn = inject(AUTH_SERVICE).isAuthenticated;

  readonly id = input.required<string>();

  protected readonly state = signal<State>('loading');
  protected readonly hub = signal<EventHubDto | null>(null);
  /** Read by a hub manager, the page is the preview (L2-163 AC2); visitors see no banner (L2-167 AC1). */
  protected readonly preview = computed(() => !!this.hub()?.canManage);
  protected readonly signInHref = computed(
    () => `/sign-in?returnUrl=${encodeURIComponent(`/public/events/${this.id()}/hub`)}`,
  );
  /** The sections a visitor would see, in order (L2-163 AC1). */
  protected readonly shown = computed<HubSectionDto[]>(() => {
    const hub = this.hub();
    if (!hub) return [];
    return hub.sections.filter(
      (s) =>
        s.visible &&
        s.state === 'Ready' &&
        (s.kind !== 'UpcomingEvents' || hub.upcomingEvents.length > 0),
    );
  });
  protected readonly agenda = computed(() => {
    const hub = this.hub();
    return (hub && sectionContent(hub, 'Agenda')?.items) ?? [];
  });
  protected readonly people = computed(() => {
    const hub = this.hub();
    return (hub && sectionContent(hub, 'People')?.people) ?? [];
  });

  constructor() {
    effect(() => void this.load(this.id()));

    // L2-192 AC1, AC2: read again every 30 seconds while the tab is visible, and at once when it is shown again.
    const document = inject(DOCUMENT);
    const visible = () => document.visibilityState === 'visible';
    const timer = setInterval(() => {
      if (visible()) void this.refresh();
    }, HUB_REFRESH_MS);
    const shown = () => {
      if (visible()) void this.refresh();
    };
    document.addEventListener('visibilitychange', shown);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', shown);
    });
  }

  /**
   * Replaces what the page shows without a loading state (L2-192 AC1); a failure keeps it and the next turn tries again,
   * and a hub that has become unavailable says so (AC3).
   */
  private async refresh(): Promise<void> {
    if (this.state() !== 'loaded') return;
    const id = this.id();
    try {
      const hub = await firstValueFrom(this.hubs.page(id));
      if (id !== this.id() || this.state() !== 'loaded') return;
      this.hub.set(hub);
      this.describe(hub);
    } catch (error) {
      if (id !== this.id()) return;
      if (error instanceof HttpErrorResponse && (error.status === 403 || error.status === 404))
        this.state.set('unavailable');
    }
  }

  protected retry(): void {
    void this.load(this.id());
  }

  private async load(id: string): Promise<void> {
    this.state.set('loading');
    try {
      const hub = await firstValueFrom(this.hubs.page(id));
      if (id !== this.id()) return;
      this.hub.set(hub);
      this.describe(hub);
      this.state.set('loaded');
    } catch (error) {
      if (id !== this.id()) return;
      const unavailable =
        error instanceof HttpErrorResponse && (error.status === 403 || error.status === 404);
      this.state.set(unavailable ? 'unavailable' : 'error');
    }
  }

  /**
   * The document title is the event's title, and the meta description the Hero subtitle or the event's date, time and
   * place (L2-167 AC1); the preview keeps "{event} hub".
   */
  private describe(hub: EventHubDto): void {
    const e = hub.event;
    this.title.setTitle(hub.canManage ? `${e.title} hub` : e.title);
    const subtitle = sectionContent(hub, 'Hero')?.subtitle;
    const place = e.format === 'Online' ? 'Online' : e.venue;
    const description =
      subtitle || [formatTimeRange(e.startsAt, e.endsAt), place].filter(Boolean).join(' · ');
    this.meta.updateTag({ name: 'description', content: description });
  }
}
