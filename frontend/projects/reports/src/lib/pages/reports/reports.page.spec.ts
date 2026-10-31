// Traces to: L2-124, L2-125, L2-127 (docs/detailed-designs/reports/reports-dashboard)
import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { ChapterLabel, REPORTS_SERVICE, ReportDto, SITE_SERVICE } from '@faithtech-community/api';
import { ToastService } from '@faithtech-community/components';
import { Observable, of, throwError } from 'rxjs';

import { ReportsPage } from './reports.page';

function report(overrides: Partial<ReportDto> = {}): ReportDto {
  return {
    chapter: null,
    chapterName: null,
    period: 'last-30-days',
    from: '2026-09-21T12:00:00Z',
    to: '2026-10-21T12:00:00Z',
    chapters: [
      { id: 'c-toronto', name: 'Toronto' },
      { id: 'c-austin', name: 'Austin' },
    ],
    isEmpty: false,
    figures: {
      members: { value: 412, newInPeriod: 18 },
      eventsHeld: { value: 3, cancelled: 0 },
      rsvps: { value: 97, checkedIn: 82, checkedInPercent: 85 },
      partnersConfirmed: { value: 5, inPipeline: 12 },
      announcements: { value: 4 },
    },
    membersByChapter: [{ label: 'Toronto', value: 186 }],
    newMembersByMonth: [
      { month: '2026-09', label: 'Sep', value: 5, soFar: false },
      { month: '2026-10', label: 'Oct', value: 13, soFar: true },
    ],
    partnerPipeline: [{ chapter: 'Toronto', lead: 3, inFunnel: 2, confirmed: 4 }],
    events: [
      {
        id: 'e1',
        title: 'Vancouver Builders Night',
        startsAt: '2026-10-09T23:00:00Z',
        chapter: 'Vancouver',
        status: 'Held',
        going: 41,
        checkedIn: 36,
        checkedInPercent: 88,
      },
    ],
    ...overrides,
  };
}

const CITIES: ChapterLabel = { singular: 'City', plural: 'Cities' };

async function setup(
  get: () => Observable<ReportDto> = () => of(report()),
  exportCsv: () => Observable<Blob> = () => of(new Blob(['csv'])),
  chapterLabel: ChapterLabel | null = CITIES,
) {
  const service = { getReport: vi.fn(get), exportCsv: vi.fn(exportCsv) };
  const toasts = { show: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: REPORTS_SERVICE, useValue: service },
      { provide: ToastService, useValue: toasts },
      {
        provide: SITE_SERVICE,
        useValue: {
          site: signal({ name: 'FaithTech Community', shortName: 'FaithTech', chapterLabel }),
        },
      },
    ],
  });
  const router = TestBed.inject(Router);
  const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(ReportsPage);
  const settle = async () => {
    for (let i = 0; i < 3; i++) {
      fixture.detectChanges();
      await fixture.whenStable();
    }
  };
  await settle();
  const text = () => (fixture.nativeElement as HTMLElement).textContent!.replace(/\s+/g, ' ');
  return { fixture, service, toasts, navigate, settle, text };
}

describe('ReportsPage', () => {
  it('asks for All cities and the last 30 days when the URL has no filters', async () => {
    const { service } = await setup();

    expect(service.getReport).toHaveBeenCalledWith({ chapter: null, period: 'last-30-days' });
  });

  it('writes the context lines from the numbers', async () => {
    const { text } = await setup();

    expect(text()).toContain('+18 in the last 30 days');
    expect(text()).toContain('0 cancelled');
    expect(text()).toContain('85% checked in');
    expect(text()).toContain('of 12 in the pipeline');
    expect(text()).toContain('sent by leads');
    expect(text()).toContain('Oct so far');
    expect(text()).toContain('36 (88%)');
  });

  it('hides the new-members line for All time and the rate when there are no RSVPs', async () => {
    const base = report();
    const { text } = await setup(() =>
      of(
        report({
          period: 'all-time',
          figures: {
            ...base.figures,
            members: { value: 412, newInPeriod: null },
            rsvps: { value: 0, checkedIn: 0, checkedInPercent: null },
          },
        }),
      ),
    );

    expect(text()).not.toContain('in the all time');
    expect(text()).not.toContain('checked in RSVPs');
    expect(text()).not.toContain('% checked in');
  });

  it('shows the forbidden state on 403', async () => {
    const { text } = await setup(() => throwError(() => new HttpErrorResponse({ status: 403 })));

    expect(text()).toContain('Reports are for Staff and System Admin');
  });

  it('shows the error state with Try again on a failure', async () => {
    const { text } = await setup(() => throwError(() => new HttpErrorResponse({ status: 500 })));

    expect(text()).toContain('We couldn’t load the reports');
    expect(text()).toContain('Try again');
  });

  it('falls back to the defaults with a message on 400', async () => {
    const { text, navigate, fixture, settle } = await setup(() =>
      throwError(() => new HttpErrorResponse({ status: 400 })),
    );
    fixture.componentRef.setInput('chapter', 'Atlantis');
    await settle();

    expect(navigate).toHaveBeenCalledWith(['/reports'], {
      queryParams: { chapter: '', period: 'last-30-days' },
      replaceUrl: true,
    });
    expect(text()).toContain('We couldn’t use that filter');
  });

  it('says there is nothing to report for an empty city', async () => {
    const { text } = await setup(() =>
      of(report({ chapter: 'c-calgary', chapterName: 'Calgary', isEmpty: true })),
    );

    expect(text()).toContain('Nothing to report for Calgary in the last 30 days');
  });

  it('exports the report shown, under the server file name', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:report');
    URL.revokeObjectURL = vi.fn();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const { fixture, service, settle } = await setup(() =>
      of(report({ chapter: 'c-toronto', chapterName: 'Toronto' })),
    );

    exportButton(fixture.nativeElement).click();
    await settle();

    expect(service.exportCsv).toHaveBeenCalledWith({
      chapter: 'c-toronto',
      period: 'last-30-days',
    });
    const link = click.mock.contexts[0] as HTMLAnchorElement;
    expect(link.download).toBe('faithtech-report-toronto-last-30-days-2026-10-21.csv');
    click.mockRestore();
  });

  // Traces to: L2-142 AC1
  it('filters by the active chapters, labelled from the organisation', async () => {
    const { fixture, text } = await setup();
    const select = (fixture.nativeElement as HTMLElement).querySelector('select')!;

    expect(Array.from(select.options).map((o) => o.textContent!.trim())).toEqual([
      'All cities',
      'Toronto',
      'Austin',
    ]);
    expect(text()).toContain('Partner pipeline by city');
    expect(text()).toContain('Members by city');
  });

  // Traces to: L2-142 AC3
  it('is organisation-wide with no chapter filter, column or chart while chapters are off', async () => {
    const { fixture, text } = await setup(
      () => of(report({ chapters: [], membersByChapter: [] })),
      undefined,
      null,
    );
    const root = fixture.nativeElement as HTMLElement;
    const selects = Array.from(root.querySelectorAll('select'));

    expect(selects.map((s) => s.options[0].textContent!.trim())).toEqual(['Last 30 days']);
    expect(text()).not.toMatch(/city/i);
    expect(text()).toContain('Partner pipeline');
    expect(
      Array.from(root.querySelectorAll('th')).map((th) => th.textContent!.trim()),
    ).not.toContain('City');
  });

  it('offers Try again in a danger toast when the export fails', async () => {
    const { fixture, toasts, settle } = await setup(undefined, () =>
      throwError(() => new HttpErrorResponse({ status: 500 })),
    );

    exportButton(fixture.nativeElement).click();
    await settle();

    expect(toasts.show).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'danger',
        heading: 'Couldn’t export the report. Try again.',
        actionLabel: 'Try again',
      }),
    );
  });
});

function exportButton(root: HTMLElement): HTMLButtonElement {
  return [...root.querySelectorAll('button')].find((b) => b.textContent!.includes('Export CSV'))!;
}
