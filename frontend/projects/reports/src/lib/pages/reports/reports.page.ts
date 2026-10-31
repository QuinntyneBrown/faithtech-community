import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  OrganisationNames,
  REPORTS_SERVICE,
  ReportDto,
  ReportEventRowDto,
  ReportFilters,
  ReportPeriod,
} from '@faithtech-community/api';
import {
  AlertComponent,
  BreakpointService,
  ButtonComponent,
  CardComponent,
  CardFooterComponent,
  ClusterComponent,
  EmptyStateComponent,
  FilterBarComponent,
  FormFieldComponent,
  IconComponent,
  LinkComponent,
  PageHeaderComponent,
  ProgressChartComponent,
  ProgressChartRow,
  SelectComponent,
  SelectOption,
  SkeletonComponent,
  SplitComponent,
  StackComponent,
  StatComponent,
  TableColumn,
  TableComponent,
  ToastService,
  formatDay,
  formatTime,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

import { reportFileName, saveFile } from '../../download';

type State = 'loading' | 'loaded' | 'error' | 'forbidden';

const PERIODS: { value: ReportPeriod; label: string }[] = [
  { value: 'last-30-days', label: 'Last 30 days' },
  { value: 'last-90-days', label: 'Last 90 days' },
  { value: 'this-year', label: 'This year' },
  { value: 'all-time', label: 'All time' },
];

const DEFAULT_PERIOD: ReportPeriod = 'last-30-days';

/** "last 30 days", as the copy reads after "in the". */
function describe(period: ReportPeriod): string {
  return PERIODS.find((p) => p.value === period)!.label.toLowerCase();
}

/**
 * Reports (L2-123 to L2-127), matching docs/mocks/pages/reports: figures by chapter, two bar charts and two tables
 * for the filters in the URL (`?chapter=&period=`). Every number comes from the server (ADR 0030); the page only
 * writes the copy around them. It has no write action.
 */
@Component({
  selector: 'ft-reports-page',
  imports: [
    NgTemplateOutlet,
    ReactiveFormsModule,
    AlertComponent,
    ButtonComponent,
    CardComponent,
    CardFooterComponent,
    ClusterComponent,
    EmptyStateComponent,
    FilterBarComponent,
    FormFieldComponent,
    IconComponent,
    LinkComponent,
    PageHeaderComponent,
    ProgressChartComponent,
    SelectComponent,
    SkeletonComponent,
    SplitComponent,
    StackComponent,
    StatComponent,
    TableComponent,
  ],
  templateUrl: './reports.page.html',
  styleUrl: './reports.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportsPage {
  private readonly service = inject(REPORTS_SERVICE);
  private readonly router = inject(Router);
  private readonly breakpoints = inject(BreakpointService);
  private readonly toasts = inject(ToastService);
  private readonly names = inject(OrganisationNames);

  /** Query parameters. */
  readonly chapter = input<string | undefined>();
  readonly period = input<string | undefined>();

  protected readonly state = signal<State>('loading');
  protected readonly report = signal<ReportDto | null>(null);
  /** The URL held a chapter or period the server refused, so the defaults are shown (L2-124 AC5). */
  protected readonly fellBack = signal(false);
  protected readonly exporting = signal(false);
  protected readonly chapterControl = new FormControl('', { nonNullable: true });
  protected readonly periodControl = new FormControl<ReportPeriod>(DEFAULT_PERIOD, {
    nonNullable: true,
  });
  protected readonly periods: SelectOption[] = PERIODS;
  /** Figures and charts are one column on phones (L2-126 AC6). */
  protected readonly wide = this.breakpoints.isAtLeast('sm');
  private latest = 0;

  protected readonly filters = computed<ReportFilters>(() => ({
    chapter: this.chapter() || null,
    period: (this.period() || DEFAULT_PERIOD) as ReportPeriod,
  }));

  /** The organisation's chapter label in lower case ("city", "cities"), or null while chapters are off (L2-140). */
  protected readonly chapterSingular = computed(
    () => this.names.chapterLabel()?.singular.toLowerCase() ?? null,
  );
  protected readonly chapterLabel = computed(() => this.names.chapterLabel()?.singular ?? '');
  protected readonly chaptersPlural = computed(
    () => this.names.chapterLabel()?.plural.toLowerCase() ?? null,
  );
  /** "All cities". */
  protected readonly allChapters = computed(() => `All ${this.chaptersPlural()}`);

  /** The active chapters (L2-142 AC1); none while chapters are off, so the filter is not drawn. */
  protected readonly chapterOptions = computed<SelectOption[]>(() =>
    this.chapterSingular()
      ? (this.report()?.chapters ?? []).map((c) => ({ value: c.id, label: c.name }))
      : [],
  );

  /** "Partner pipeline by city", or "Partner pipeline" while chapters are off. */
  protected readonly pipelineHeading = computed(() =>
    this.chapterSingular() ? `Partner pipeline by ${this.chapterSingular()}` : 'Partner pipeline',
  );
  protected readonly pipelineCaption = computed(() =>
    this.chapterSingular()
      ? `Partners in each stage, per ${this.chapterSingular()}`
      : 'Partners in each stage',
  );
  protected readonly pipelineFooter = computed(() =>
    this.chapterSingular()
      ? `One shared pipeline, a snapshot today; a partner counts for its owner’s home ${this.chapterSingular()}.`
      : 'One shared pipeline, a snapshot today.',
  );
  protected readonly membersHeading = computed(() => `Members by ${this.chapterSingular()}`);
  protected readonly fallbackHeading = computed(() =>
    this.chaptersPlural()
      ? `We couldn’t use that filter, so this shows all ${this.chaptersPlural()} for the last 30 days.`
      : 'We couldn’t use that filter, so this shows the last 30 days.',
  );

  protected readonly periodText = computed(() => describe(this.report()?.period ?? DEFAULT_PERIOD));

  /** "All cities · Last 30 days · updated today at 3:05 pm"; without the chapter while chapters are off. */
  protected readonly subtitle = computed(() => {
    const r = this.report();
    if (!r || this.state() === 'loading') return null;
    const label = PERIODS.find((p) => p.value === r.period)!.label;
    const to = new Date(r.to);
    const day = to.toDateString() === new Date().toDateString() ? 'today' : formatDay(r.to);
    const scope = this.chapterSingular() ? `${r.chapterName ?? this.allChapters()} · ` : '';
    return `${scope}${label} · updated ${day} at ${formatTime(to)}`;
  });

  protected readonly figures = computed(() => {
    const r = this.report();
    if (!r) return [];
    const f = r.figures;
    const percent = f.rsvps.checkedInPercent;
    return [
      {
        label: 'Members',
        value: f.members.value,
        context:
          f.members.newInPeriod === null
            ? null
            : `+${f.members.newInPeriod} in the ${describe(r.period)}`,
      },
      {
        label: 'Events held',
        value: f.eventsHeld.value,
        context: `${f.eventsHeld.cancelled} cancelled`,
      },
      {
        label: 'RSVPs',
        value: f.rsvps.value,
        context: percent === null ? null : `${percent}% checked in`,
      },
      {
        label: 'Partners confirmed',
        value: f.partnersConfirmed.value,
        context: `of ${f.partnersConfirmed.inPipeline} in the pipeline`,
      },
      { label: 'Announcements', value: f.announcements.value, context: 'sent by leads' },
    ];
  });

  protected readonly loadingFigures = [
    'Members',
    'Events held',
    'RSVPs',
    'Partners confirmed',
    'Announcements',
  ];

  protected readonly membersByChapter = computed<ProgressChartRow[]>(
    () => this.report()?.membersByChapter ?? [],
  );

  protected readonly newMembersByMonth = computed<ProgressChartRow[]>(() =>
    (this.report()?.newMembersByMonth ?? []).map((m) => ({
      label: m.soFar ? `${m.label} so far` : m.label,
      value: m.value,
    })),
  );

  protected readonly pipelineColumns = computed<TableColumn[]>(() => [
    { key: 'chapter', header: this.chapterLabel() || 'Pipeline', rowHeader: true },
    { key: 'lead', header: 'Lead' },
    { key: 'inFunnel', header: 'In funnel' },
    { key: 'confirmed', header: 'Confirmed' },
  ]);

  protected readonly pipelineRows = computed(
    () => (this.report()?.partnerPipeline ?? []) as unknown as Record<string, unknown>[],
  );

  private readonly eventCell = viewChild<TemplateRef<unknown>>('eventCell');

  protected readonly eventColumns = computed<TableColumn[]>(() => [
    { key: 'title', header: 'Event', rowHeader: true, template: this.eventCell() },
    { key: 'date', header: 'Date' },
    ...(this.chapterLabel() ? [{ key: 'chapter', header: this.chapterLabel() }] : []),
    { key: 'going', header: 'Going' },
    { key: 'attendance', header: 'Checked in' },
  ]);

  protected readonly eventRows = computed(() =>
    (this.report()?.events ?? []).map((e) => ({
      ...e,
      date: formatDay(e.startsAt),
      going: e.going ?? '—',
      attendance: this.attendance(e),
    })),
  );

  /** "Nothing to report for Calgary in the last 30 days", or "…for Calgary yet" for All time. */
  protected readonly emptyHeading = computed(() => {
    const r = this.report();
    if (!r) return '';
    const scope = this.chapterSingular() ? ` for ${r.chapterName ?? this.allChapters()}` : '';
    return r.period === 'all-time'
      ? `Nothing to report${scope} yet`
      : `Nothing to report${scope} in the ${describe(r.period)}`;
  });

  protected readonly emptyText = computed(() => {
    const r = this.report();
    if (!r) return '';
    const singular = this.chapterSingular();
    if (!singular) {
      return r.period === 'all-time'
        ? 'No one has joined and no events have run yet.'
        : `No one joined and no events ran in the ${describe(r.period)}. Widen the period.`;
    }
    const where = r.chapterName ?? `any ${singular}`;
    return r.period === 'all-time'
      ? `No one has joined and no events have run in ${where} yet. Pick another ${singular}.`
      : `No one joined and no events ran in ${where} in the ${describe(r.period)}. Widen the period or pick another ${singular}.`;
  });

  constructor() {
    effect(() => {
      const filters = this.filters();
      this.chapterControl.setValue(filters.chapter ?? '');
      this.periodControl.setValue(filters.period);
      void this.load(filters);
    });
  }

  /** Apply: the URL carries both filters, so the view can be bookmarked (L2-124 AC4). */
  protected apply(): void {
    this.fellBack.set(false);
    this.go(this.chapterControl.value || null, this.periodControl.value);
  }

  /** Downloads the report shown as CSV; Export CSV stays busy until it is saved (L2-128 AC4). */
  protected async exportCsv(): Promise<void> {
    const r = this.report();
    if (!r || this.exporting()) return;
    this.exporting.set(true);
    try {
      const filters: ReportFilters = { chapter: r.chapter, period: r.period };
      saveFile(
        await firstValueFrom(this.service.exportCsv(filters)),
        reportFileName(
          this.names.shortName(),
          r.chapterName,
          this.chaptersPlural(),
          r.period,
          r.to,
        ),
      );
    } catch {
      this.toasts.show({
        variant: 'danger',
        heading: 'Couldn’t export the report. Try again.',
        actionLabel: 'Try again',
        onAction: () => void this.exportCsv(),
      });
    } finally {
      this.exporting.set(false);
    }
  }

  protected retry(): void {
    void this.load(this.filters());
  }

  protected showChapter(chapter: string | null): void {
    this.go(chapter, this.report()?.period ?? DEFAULT_PERIOD);
  }

  protected showPeriod(period: ReportPeriod): void {
    this.go(this.report()?.chapter ?? null, period);
  }

  private go(chapter: string | null, period: ReportPeriod, replaceUrl = false): void {
    const same = chapter === this.filters().chapter && period === this.filters().period;
    if (same && !replaceUrl) {
      void this.load(this.filters());
      return;
    }
    void this.router.navigate(['/reports'], {
      queryParams: { chapter: chapter ?? '', period },
      replaceUrl,
    });
  }

  /** "36 (88%)" for an event held, or Upcoming or Cancelled in place of the attendance. */
  private attendance(e: ReportEventRowDto): string {
    if (e.status !== 'Held') return e.status;
    return e.checkedInPercent === null
      ? String(e.checkedIn)
      : `${e.checkedIn} (${e.checkedInPercent}%)`;
  }

  private async load(filters: ReportFilters): Promise<void> {
    const request = ++this.latest;
    this.state.set('loading');
    try {
      const report = await firstValueFrom(this.service.getReport(filters));
      if (request !== this.latest) return;
      this.report.set(report);
      this.state.set('loaded');
    } catch (error) {
      if (request !== this.latest) return;
      const status = error instanceof HttpErrorResponse ? error.status : 0;
      if (status === 400) {
        this.fellBack.set(true);
        this.go(null, DEFAULT_PERIOD, true);
        return;
      }
      this.state.set(status === 403 ? 'forbidden' : 'error');
    }
  }
}
