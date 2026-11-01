// Traces to: L2-163 (docs/detailed-designs/events/preview-and-publish-hub)
import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AUTH_SERVICE, EVENT_HUBS_SERVICE, EventHubDto } from '@faithtech-community/api';
import { Observable, of, throwError } from 'rxjs';

import { HubPage } from './hub.page';

const hub: EventHubDto = {
  id: 'h1',
  eventId: 'e1',
  status: 'Draft',
  publishedAt: null,
  canManage: true,
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
    { kind: 'Hero', visible: true, state: 'Ready', content: { subtitle: 'A night of building' } },
    { kind: 'Agenda', visible: true, state: 'NeedsInfo', content: { items: [] } },
    { kind: 'Giving', visible: false, state: 'Hidden', content: { line: null } },
    { kind: 'UpcomingEvents', visible: true, state: 'Ready', content: { count: 3 } },
  ],
  organisation: {
    name: 'FaithTech Community',
    shortName: 'FaithTech',
    givingLink: 'https://faithtech.com/donate',
    givingText: 'Help us build the next one.',
  },
  upcomingEvents: [],
};

const service = { page: vi.fn() };

async function setup(page: () => Observable<EventHubDto>, signedIn = true) {
  service.page.mockReset();
  service.page.mockImplementation(page);
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: EVENT_HUBS_SERVICE, useValue: service },
      { provide: AUTH_SERVICE, useValue: { isAuthenticated: signal(signedIn) } },
    ],
  });
  const fixture = TestBed.createComponent(HubPage);
  fixture.componentRef.setInput('id', 'e1');
  for (let i = 0; i < 3; i++) {
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
  }
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('HubPage', () => {
  it('shows only visible, ready sections, and leaves Upcoming events out when there are none', async () => {
    const host = await setup(() => of(hub));

    expect(host.querySelector('ft-hub-hero')).not.toBeNull();
    expect(host.querySelector('ft-hub-agenda')).toBeNull();
    expect(host.querySelector('ft-hub-giving')).toBeNull();
    expect(host.querySelector('ft-hub-upcoming')).toBeNull();
    expect(host.textContent).toContain('It’s a draft, so visitors can’t open it yet.');
  });

  it('says a published hub is what visitors see', async () => {
    const host = await setup(() =>
      of({ ...hub, status: 'Published', publishedAt: hub.event.startsAt }),
    );

    expect(host.textContent).toContain('This is your published hub, as visitors see it.');
  });

  it('says there is nothing to show when no section is shown', async () => {
    const host = await setup(() => of({ ...hub, sections: [] }));

    expect(host.textContent).toContain('Nothing to show yet');
  });

  it.each([403, 404])('treats %i as not available', async (status) => {
    const host = await setup(() => throwError(() => new HttpErrorResponse({ status })));

    expect(host.textContent).toContain('This hub isn’t available');
  });

  it('offers Try again after a failure, which loads the hub', async () => {
    let calls = 0;
    const host = await setup(() =>
      calls++ === 0 ? throwError(() => new HttpErrorResponse({ status: 500 })) : of(hub),
    );
    expect(host.textContent).toContain('We couldn’t load the hub');

    host.querySelector<HTMLElement>('ft-button button')?.click();
    await new Promise((resolve) => setTimeout(resolve));

    expect(service.page).toHaveBeenCalledTimes(2);
  });

  // L2-167 AC1: a visitor sees no Preview banner.
  it('shows no Preview banner to a visitor', async () => {
    const host = await setup(() => of({ ...hub, status: 'Published', canManage: false }));

    expect(host.querySelector('.hub-page__banner')).toBeNull();
    expect(host.querySelector('ft-hub-hero')).not.toBeNull();
  });

  // L2-166 AC2: an anonymous visitor is offered Sign in, back to the hub.
  it('offers an anonymous visitor Sign in when the hub is not available', async () => {
    const host = await setup(() => throwError(() => new HttpErrorResponse({ status: 404 })), false);

    expect(host.textContent).toContain('Members can sign in to see it.');
    expect(host.querySelector('a')?.getAttribute('href')).toBe(
      `/sign-in?returnUrl=${encodeURIComponent('/public/events/e1/hub')}`,
    );
  });
});
