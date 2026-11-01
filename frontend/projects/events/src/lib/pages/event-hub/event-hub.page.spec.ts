// Traces to: L2-154, L2-156 (docs/detailed-designs/events/create-event-hub, fill-in-hub-sections)
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { EVENT_HUBS_SERVICE, EventHubDto } from '@faithtech-community/api';
import { ToastService } from '@faithtech-community/components';
import { Observable, of, throwError } from 'rxjs';

import { EventHubPage } from './event-hub.page';

const hub: EventHubDto = {
  id: 'h1',
  eventId: 'e1',
  status: 'Draft',
  publishedAt: null,
  templateKey: 'blank',
  link: 'http://localhost/public/events/e1/hub',
  event: {
    title: 'Toronto Builders Night',
    startsAt: new Date(2026, 10, 6, 18, 30).toISOString(),
    endsAt: new Date(2026, 10, 6, 21).toISOString(),
    format: 'InPerson',
    venue: 'Kestrel Labs',
    onlineLink: null,
    rsvpLink: 'http://localhost/public/events/e1',
    isCancelled: false,
  },
  sections: [
    { kind: 'Hero', visible: true, state: 'Ready', content: { subtitle: null } },
    { kind: 'Agenda', visible: true, state: 'NeedsInfo', content: { items: [] } },
    { kind: 'Giving', visible: false, state: 'Hidden', content: { line: null } },
  ],
  organisation: {
    name: 'FaithTech Community',
    shortName: 'FaithTech',
    givingLink: 'https://faithtech.com/donate',
    givingText: 'Help us build the next one.',
  },
  upcomingEvents: [],
};

const service = {
  get: vi.fn(),
  create: vi.fn(),
  save: vi.fn(),
  saveSection: vi.fn(),
  reorder: vi.fn(),
  publish: vi.fn(),
  unpublish: vi.fn(),
};
const toasts = { show: vi.fn() };

async function setup(get: () => Observable<EventHubDto> = () => of(hub)) {
  service.get.mockImplementation(get);
  service.save.mockReturnValue(of(undefined));
  toasts.show.mockClear();
  TestBed.configureTestingModule({
    providers: [
      { provide: EVENT_HUBS_SERVICE, useValue: service },
      { provide: ToastService, useValue: toasts },
    ],
  });
  const fixture = TestBed.createComponent(EventHubPage);
  fixture.componentRef.setInput('id', 'e1');
  for (let i = 0; i < 3; i++) {
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
  }
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('EventHubPage', () => {
  it('shows the status, the link and one row per section with how many are ready', async () => {
    const host = await setup();

    expect(host.textContent).toContain('Toronto Builders Night');
    expect(host.textContent).toContain('Draft');
    expect(host.querySelector<HTMLInputElement>('ft-copy-field input')?.value).toBe(hub.link);
    expect(host.textContent).toContain('1 of 2 sections ready');
    expect(host.querySelectorAll('ft-checklist-row')).toHaveLength(3);
    expect(host.querySelector('ft-checklist-row.ft-checklist-row--hidden')?.textContent).toContain(
      'Giving',
    );
  });

  it.each([
    [403, 'You can’t manage event hubs'],
    [404, 'This event has no hub yet'],
    [500, 'We couldn’t load this hub'],
  ])('answers %i with the matching state', async (status, heading) => {
    const host = await setup(() => throwError(() => new HttpErrorResponse({ status })));

    expect(host.textContent).toContain(heading);
  });

  // L2-156 AC2: a Needs info row says what is missing.
  it('says what a Needs info section is missing', async () => {
    const host = await setup();

    const agenda = host.querySelectorAll('ft-checklist-row')[1];
    expect(agenda.textContent).toContain('Add the day’s schedule.');
  });

  // L2-156 AC1, AC3: a shown section has its More menu; a hidden one offers Show, which saves only its visibility.
  it('offers Show on a hidden section and saves it shown', async () => {
    const host = await setup();
    const rows = host.querySelectorAll('ft-checklist-row');
    expect(rows[0].querySelector('ft-menu button')?.getAttribute('aria-label')).toBe(
      'More for Hero',
    );
    expect(rows[2].querySelector('ft-menu')).toBeNull();

    rows[2].querySelector<HTMLButtonElement>('ft-button button')!.click();
    await new Promise((resolve) => setTimeout(resolve));

    expect(service.save).toHaveBeenCalledWith('e1', {
      templateKey: 'blank',
      sections: [{ kind: 'Giving', visible: true }],
    });
    expect(toasts.show).toHaveBeenCalledWith(expect.objectContaining({ heading: 'Giving shown' }));
  });

  // L2-156 AC6: a failed visibility change says so.
  it('says when a section could not be shown', async () => {
    const host = await setup();
    service.save.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));

    host
      .querySelectorAll('ft-checklist-row')[2]
      .querySelector<HTMLButtonElement>('ft-button button')!
      .click();
    await new Promise((resolve) => setTimeout(resolve));

    expect(toasts.show).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'danger', heading: 'We couldn’t show Giving' }),
    );
  });

  // L2-164 AC1, AC2: Publish says so and the page shows the published time.
  it('publishes the hub and says visitors can open it', async () => {
    const host = await setup();
    service.publish.mockReturnValue(of(undefined));
    service.get.mockReturnValue(
      of({ ...hub, status: 'Published', publishedAt: new Date(2026, 10, 1, 15, 40).toISOString() }),
    );

    Array.from(host.querySelectorAll<HTMLButtonElement>('ft-button button'))
      .find((b) => b.textContent?.trim() === 'Publish')!
      .click();
    await new Promise((resolve) => setTimeout(resolve));

    expect(service.publish).toHaveBeenCalledWith('e1');
    expect(toasts.show).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'success', heading: 'Hub published' }),
    );
  });

  // L2-164 AC1: a failed publish offers Try again on its toast.
  it('offers Try again when publishing fails', async () => {
    const host = await setup();
    service.publish.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));

    Array.from(host.querySelectorAll<HTMLButtonElement>('ft-button button'))
      .find((b) => b.textContent?.trim() === 'Publish')!
      .click();
    await new Promise((resolve) => setTimeout(resolve));

    expect(toasts.show).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'danger',
        heading: 'We couldn’t publish the hub',
        actionLabel: 'Try again',
      }),
    );
  });

  // L2-164 AC2: a published hub shows when and offers Unpublish.
  it('shows when a published hub was published, and Unpublish', async () => {
    const host = await setup(() =>
      of({ ...hub, status: 'Published', publishedAt: new Date(2026, 10, 1, 15, 40).toISOString() }),
    );

    expect(host.textContent).toContain('Sun 1 Nov · 3:40 pm');
    expect(host.textContent).toContain('Visitors can open it now.');
    expect(host.textContent).toContain('Unpublish');
  });
});
