import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { Title } from '@angular/platform-browser';
import { EVENT_HUBS_SERVICE, EventHubDto, HubSectionDto } from '@faithtech-community/api';
import {
  AlertComponent,
  ButtonComponent,
  CardComponent,
  EmptyStateComponent,
  IconComponent,
  LinkComponent,
  SkeletonComponent,
  StackComponent,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

import {
  HubAgendaComponent,
  HubGivingComponent,
  HubHeroComponent,
  HubLinksComponent,
  HubPeopleComponent,
  HubUpcomingComponent,
  HubVenueComponent,
  sectionContent,
} from '../../hub-sections';

type State = 'loading' | 'loaded' | 'unavailable' | 'error';

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

  readonly id = input.required<string>();

  protected readonly state = signal<State>('loading');
  protected readonly hub = signal<EventHubDto | null>(null);
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
  }

  protected retry(): void {
    void this.load(this.id());
  }

  private async load(id: string): Promise<void> {
    this.state.set('loading');
    try {
      const hub = await firstValueFrom(this.hubs.get(id));
      if (id !== this.id()) return;
      this.hub.set(hub);
      this.title.setTitle(`${hub.event.title} hub`);
      this.state.set('loaded');
    } catch (error) {
      if (id !== this.id()) return;
      const unavailable =
        error instanceof HttpErrorResponse && (error.status === 403 || error.status === 404);
      this.state.set(unavailable ? 'unavailable' : 'error');
    }
  }
}
