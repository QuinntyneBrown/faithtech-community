// Traces to: L2-162 AC2 (docs/detailed-designs/events/fill-in-hub-sections)
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HubUpcomingEventDto } from '@faithtech-community/api';

import { HubUpcomingComponent } from './hub-upcoming.component';

function render(events: HubUpcomingEventDto[]) {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(HubUpcomingComponent);
  fixture.componentRef.setInput('events', events);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('HubUpcomingComponent', () => {
  it('shows each event as a card linking to its public page', () => {
    const host = render([
      {
        id: 'e2',
        title: 'Prayer and Code Breakfast',
        startsAt: new Date(2026, 10, 21, 9).toISOString(),
        endsAt: new Date(2026, 10, 21, 11).toISOString(),
        format: 'InPerson',
        venue: 'St Lawrence Hall',
        chapterName: 'Toronto',
      },
    ]);

    const link = host.querySelector('a')!;
    expect(link.textContent?.trim()).toBe('Prayer and Code Breakfast');
    expect(link.getAttribute('href')).toBe('/public/events/e2');
    expect(host.textContent).toContain('9:00 am · St Lawrence Hall');
  });

  it('says upcoming events will appear when there are none', () => {
    expect(render([]).textContent).toContain(
      'No upcoming public events yet. They’ll appear here automatically.',
    );
  });
});
