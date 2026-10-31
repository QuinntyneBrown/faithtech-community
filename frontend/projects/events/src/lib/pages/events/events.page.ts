import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  AUTH_SERVICE,
  EVENTS_SERVICE,
  EventListFilter,
  EventSummaryDto,
  OrganisationNames,
  canManageEvents,
} from '@faithtech-community/api';
import {
  ButtonComponent,
  CardComponent,
  ChipComponent,
  ChipGroupComponent,
  EmptyStateComponent,
  EventCardComponent,
  EventVisibility,
  FormFieldComponent,
  IconComponent,
  ListComponent,
  ListSkeletonComponent,
  PageHeaderComponent,
  SelectComponent,
  SelectOption,
  formatDayRange,
  formatMonth,
  formatTime,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

type State = 'loading' | 'loaded' | 'error';

const CHIPS: EventListFilter[] = ['Upcoming', 'Past', 'Hackathons', 'Online'];

const NO_RESULTS: Record<EventListFilter, string> = {
  Upcoming: 'No upcoming events',
  Past: 'No past events',
  Hackathons: 'No upcoming hackathons',
  Online: 'No upcoming online events',
};

interface EventRow {
  id: string;
  title: string;
  month: string;
  day: string;
  meta: string;
  visibility: EventVisibility;
}

/** Events across every city, filtered by one chip and a city (L2-021), as in docs/mocks/pages/events. */
@Component({
  selector: 'ft-events-page',
  imports: [
    ReactiveFormsModule,
    ButtonComponent,
    CardComponent,
    ChipComponent,
    ChipGroupComponent,
    EmptyStateComponent,
    EventCardComponent,
    FormFieldComponent,
    IconComponent,
    ListComponent,
    ListSkeletonComponent,
    PageHeaderComponent,
    SelectComponent,
  ],
  templateUrl: './events.page.html',
  styleUrl: './events.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventsPage {
  private readonly events = inject(EVENTS_SERVICE);
  private readonly organisationNames = inject(OrganisationNames);
  private readonly capabilities = inject(AUTH_SERVICE).capabilities;

  protected readonly chips = CHIPS;
  protected readonly city = new FormControl('', { nonNullable: true });

  protected readonly state = signal<State>('loading');
  protected readonly rows = signal<EventRow[]>([]);
  protected readonly filter = signal<EventListFilter>('Upcoming');
  private readonly cities = signal<string[]>([]);
  private readonly selectedCity = signal<string | null>(null);
  private request = 0;

  protected readonly canManage = computed(() => canManageEvents(this.capabilities()));
  protected readonly cityOptions = computed<SelectOption[]>(() => [
    { value: '', label: 'All cities' },
    ...this.cities().map((c) => ({ value: c, label: c })),
  ]);
  protected readonly filtered = computed(
    () => this.filter() !== 'Upcoming' || this.selectedCity() !== null,
  );
  /** "No upcoming events in Vancouver", worded as the no-results mock words it. */
  protected readonly noResultsHeading = computed(() => {
    const city = this.selectedCity();
    const heading = NO_RESULTS[this.filter()];
    return city ? `${heading} in ${city}` : heading;
  });

  constructor() {
    this.city.valueChanges.subscribe((value) => {
      this.selectedCity.set(value || null);
      void this.load();
    });
    void this.load();
  }

  protected choose(filter: EventListFilter): void {
    if (this.filter() === filter) return;
    this.filter.set(filter);
    void this.load();
  }

  protected showAllCities(): void {
    this.city.setValue('');
  }

  protected showUpcoming(): void {
    this.choose('Upcoming');
  }

  protected retry(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    // Only the latest request may update the page, so a slow answer never overwrites a newer filter.
    const request = ++this.request;
    this.state.set('loading');
    try {
      const list = await firstValueFrom(
        this.events.listEvents({ filter: this.filter(), city: this.selectedCity() }),
      );
      if (request !== this.request) return;
      this.rows.set(
        list.events.map((e) => toRow(e, this.organisationNames.chapterPlace(e.chapterName))),
      );
      this.cities.set(list.cities);
      this.state.set('loaded');
    } catch {
      if (request === this.request) this.state.set('error');
    }
  }
}

/**
 * "Fri 6 Nov · 6:30 pm · Toronto · Kestrel Labs, 220 King St W · 34 going"; multi-day events skip the time. The
 * chapter is "{Organisation}-wide" for none, and left out while chapters are off (L2-141 AC2).
 */
function toRow(event: EventSummaryDto, chapter: string | null): EventRow {
  const start = new Date(event.startsAt);
  const when = formatDayRange(event.startsAt, event.endsAt);
  const oneDay = start.toDateString() === new Date(event.endsAt).toDateString();
  const place = event.format === 'Online' ? 'Online' : (event.venue ?? 'In person');
  const meta = [when, oneDay ? formatTime(start) : null, chapter, place, `${event.rsvpCount} going`]
    .filter((part): part is string => !!part)
    .join(' · ');
  return {
    id: event.id,
    title: event.title,
    month: formatMonth(start),
    day: String(start.getDate()),
    meta,
    visibility: event.isCancelled
      ? 'cancelled'
      : event.visibility === 'Public'
        ? 'public'
        : 'members',
  };
}
