// Traces to: L2-154 (docs/detailed-designs/events/create-event-hub)
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { EVENT_HUBS_SERVICE, EventHubDto } from '@faithtech-community/api';
import { Observable, of, throwError } from 'rxjs';

import { EventHubPage } from './event-hub.page';

const hub: EventHubDto = {
  id: 'h1',
  eventId: 'e1',
  status: 'Draft',
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
    { kind: 'Hero', visible: true, state: 'Ready' },
    { kind: 'Agenda', visible: true, state: 'NeedsInfo' },
    { kind: 'Giving', visible: false, state: 'Hidden' },
  ],
};

async function setup(get: () => Observable<EventHubDto> = () => of(hub)) {
  TestBed.configureTestingModule({
    providers: [
      {
        provide: EVENT_HUBS_SERVICE,
        useValue: { get: vi.fn(get), create: vi.fn(), save: vi.fn() },
      },
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
});
