import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  AUTH_SERVICE,
  EVENTS_SERVICE,
  EventListFilter,
  EventSummaryDto,
  ORGANISATION_SERVICE,
  ORGANISATION_WIDE,
  OrganisationNames,
  chapterFilterOptions,
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

const CHIPS: EventListFilter[] = ['Upcoming', 'Past', 'Online'];

const NO_RESULTS: Record<EventListFilter, string> = {
  Upcoming: 'No upcoming events',
  Past: 'No past events',
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

/**
 * Events across the organisation, filtered by one chip, a type and a chapter (L2-021, L2-145 AC3, L2-142), as in
 * docs/mocks/pages/events. The type filter offers "All types" and the organisation's active types; the chapter filter
 * offers the organisation-wide events too, and is absent while chapters are off.
 */
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
  private readonly organisations = inject(ORGANISATION_SERVICE);

  protected readonly chips = CHIPS;
  protected readonly chapter = new FormControl('', { nonNullable: true });
  protected readonly type = new FormControl('', { nonNullable: true });
  /** "All types" and the active types in order (L2-145 AC3). */
  protected readonly typeOptions = signal<SelectOption[]>([]);

  protected readonly state = signal<State>('loading');
  protected readonly rows = signal<EventRow[]>([]);
  protected readonly filter = signal<EventListFilter>('Upcoming');
  /** "All {chapters}", "{Organisation}-wide" and the chapters, or none while chapters are off. */
  protected readonly chapterOptions = signal<SelectOption[]>([]);
  /** The organisation's singular chapter label, or '' while chapters are off. */
  protected readonly chapterLabel = computed(
    () => this.organisationNames.chapterLabel()?.singular ?? '',
  );
  protected readonly chaptersLabel = computed(
    () => this.organisationNames.chapterLabel()?.plural.toLowerCase() ?? '',
  );
  private readonly selectedChapter = signal<string | null>(null);
  private readonly selectedType = signal<string | null>(null);
  private request = 0;

  protected readonly canManage = computed(() => canManageEvents(this.capabilities()));
  protected readonly filtered = computed(
    () =>
      this.filter() !== 'Upcoming' ||
      this.selectedChapter() !== null ||
      this.selectedType() !== null,
  );
  /**
   * "No upcoming events in Vancouver", worded as the no-results mock words it (L2-142 AC5), or "No upcoming
   * FaithTech-wide events" for the organisation-wide option.
   */
  protected readonly noResultsHeading = computed(() => {
    const id = this.selectedChapter();
    const typeKey = this.selectedType();
    const typeName = typeKey && this.typeOptions().find((o) => o.value === typeKey)?.label;
    const heading = typeName
      ? NO_RESULTS[this.filter()].replace(/ events$/, ` ${typeName} events`)
      : NO_RESULTS[this.filter()];
    const label = id && this.chapterOptions().find((o) => o.value === id)?.label;
    if (!label) return heading;
    return id === ORGANISATION_WIDE
      ? heading.replace(/ events$/, ` ${label} events`)
      : `${heading} in ${label}`;
  });
  /** "Try another city or include past events.", or without the chapter while chapters are off. */
  protected readonly noResultsText = computed(() =>
    this.chapterLabel()
      ? `Try another ${this.chapterLabel().toLowerCase()} or include past events.`
      : 'Try another filter or include past events.',
  );
  protected readonly emptyText = computed(
    () =>
      `Create the first gathering${this.chapterLabel() ? ` for your ${this.chapterLabel().toLowerCase()}` : ''}. ` +
      'Public events get a page anyone can RSVP to, even without an account.',
  );
  /** "Builders nights, hackathons and gatherings across every city". */
  protected readonly subtitle = computed(() =>
    this.chapterLabel()
      ? `Builders nights, hackathons and gatherings across every ${this.chapterLabel().toLowerCase()}`
      : 'Builders nights, hackathons and gatherings',
  );

  constructor() {
    this.chapter.valueChanges.subscribe((value) => {
      this.selectedChapter.set(value || null);
      void this.load();
    });
    this.type.valueChanges.subscribe((value) => {
      this.selectedType.set(value || null);
      void this.load();
    });
    this.organisations.get().subscribe({
      next: (organisation) => {
        this.chapterOptions.set(chapterFilterOptions(organisation, { organisationWide: true }));
        this.typeOptions.set([
          { value: '', label: 'All types' },
          ...organisation.eventTypes.map((t) => ({ value: t.key, label: t.name })),
        ]);
      },
      // Without the lists the events are shown organisation-wide and of every type, with no filters.
      error: () => {
        this.chapterOptions.set([]);
        this.typeOptions.set([]);
      },
    });
    void this.load();
  }

  protected choose(filter: EventListFilter): void {
    if (this.filter() === filter) return;
    this.filter.set(filter);
    void this.load();
  }

  protected showAllChapters(): void {
    this.chapter.setValue('');
  }

  protected showAllTypes(): void {
    this.type.setValue('');
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
        this.events.listEvents({
          filter: this.filter(),
          chapterId: this.selectedChapter(),
          type: this.selectedType(),
        }),
      );
      if (request !== this.request) return;
      this.rows.set(
        list.events.map((e) => toRow(e, this.organisationNames.chapterPlace(e.chapterName))),
      );
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
