// Traces to: L2-023 AC6
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { EVENTS_SERVICE, PublicEventDto } from '@faithtech-community/api';
import { Observable, Subject, of, throwError } from 'rxjs';

import { GuestCancelRsvpPage } from './guest-cancel-rsvp.page';

const event: PublicEventDto = {
  id: 'e1',
  title: 'Toronto Builders Night',
  description: '',
  type: 'BuildersNight',
  startsAt: new Date(2026, 10, 6, 18, 30).toISOString(),
  endsAt: new Date(2026, 10, 6, 21, 0).toISOString(),
  city: 'Toronto',
  format: 'InPerson',
  venue: 'Kestrel Labs, 220 King St W',
  rsvpCount: 34,
  isFull: false,
  isCancelled: false,
  cancellationReason: null,
};

async function setup(
  cancelGuestRsvp: () => Observable<void>,
  getPublicEvent: () => Observable<PublicEventDto> = () => of(event),
) {
  const service = {
    cancelGuestRsvp: vi.fn(cancelGuestRsvp),
    getPublicEvent: vi.fn(getPublicEvent),
  };
  TestBed.configureTestingModule({ providers: [{ provide: EVENTS_SERVICE, useValue: service }] });
  const fixture = TestBed.createComponent(GuestCancelRsvpPage);
  fixture.componentRef.setInput('id', 'e1');
  fixture.componentRef.setInput('token', 'secret');
  const settle = async () => {
    for (let i = 0; i < 3; i++) {
      fixture.detectChanges();
      await fixture.whenStable();
      await new Promise((resolve) => setTimeout(resolve));
    }
    fixture.detectChanges();
  };
  await settle();
  const host = fixture.nativeElement as HTMLElement;
  const button = (label: string) =>
    Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.trim() === label);
  const link = (label: string) =>
    Array.from(host.querySelectorAll('a')).find((a) => a.textContent?.trim() === label);
  return { fixture, host, service, button, link, settle };
}

describe('GuestCancelRsvpPage', () => {
  it('asks the guest to confirm before anything changes', async () => {
    const page = await setup(() => of(undefined));

    expect(page.host.querySelector('h1')!.textContent).toContain('Toronto Builders Night');
    expect(page.host.textContent).toContain('Cancel your RSVP?');
    expect(page.service.cancelGuestRsvp).not.toHaveBeenCalled();
    expect(page.link('Keep my RSVP')!.getAttribute('href')).toBe('/public/events/e1');
  });

  it('cancels the RSVP with the link’s token without signing in (AC6)', async () => {
    const page = await setup(() => of(undefined));

    page.button('Cancel my RSVP')!.click();
    await page.settle();

    expect(page.service.cancelGuestRsvp).toHaveBeenCalledWith('e1', 'secret');
    expect(page.host.textContent).toContain('Your RSVP is cancelled');
    expect(page.link('Back to the event')!.getAttribute('href')).toBe('/public/events/e1');
  });

  it('is busy while cancelling', async () => {
    const pending = new Subject<void>();
    const page = await setup(() => pending);

    page.button('Cancel my RSVP')!.click();
    page.fixture.detectChanges();

    expect(page.host.querySelector('button[aria-busy="true"]')!.textContent!.trim()).toBe(
      'Cancelling your RSVP…',
    );
  });

  it('says the link does not work when it is unknown or used', async () => {
    const page = await setup(() => throwError(() => new HttpErrorResponse({ status: 404 })));

    page.button('Cancel my RSVP')!.click();
    await page.settle();

    expect(page.host.textContent).toContain('This cancel link doesn’t work');
  });

  it('says nothing changed when cancelling fails', async () => {
    const page = await setup(() => throwError(() => new HttpErrorResponse({ status: 0 })));

    page.button('Cancel my RSVP')!.click();
    await page.settle();

    expect(page.host.textContent).toContain('RSVP not cancelled');
    expect(page.button('Cancel my RSVP')).toBeTruthy();
  });

  it('still offers to cancel when the event itself cannot be shown', async () => {
    const page = await setup(
      () => of(undefined),
      () => throwError(() => new HttpErrorResponse({ status: 404 })),
    );

    expect(page.host.querySelector('h1')!.textContent).toContain('Your RSVP');
    expect(page.button('Cancel my RSVP')).toBeTruthy();
  });
});
