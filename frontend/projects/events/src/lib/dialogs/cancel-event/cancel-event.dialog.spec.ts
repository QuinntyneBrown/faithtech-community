// Traces to: L2-025
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { EVENTS_SERVICE } from '@faithtech-community/api';
import { Observable, Subject, of, throwError } from 'rxjs';

import { CancelEventData, CancelEventDialog } from './cancel-event.dialog';

const data: CancelEventData = {
  eventId: 'e1',
  title: 'Toronto Builders Night',
  rsvpCount: 34,
  memberCount: 28,
};

function setup(cancelEvent: (id: string, reason: string) => Observable<void>, dialogData = data) {
  const ref = { close: vi.fn(), disableClose: false };
  const service = { cancelEvent: vi.fn(cancelEvent) };
  TestBed.configureTestingModule({
    providers: [
      { provide: DIALOG_DATA, useValue: dialogData },
      { provide: DialogRef, useValue: ref },
      { provide: EVENTS_SERVICE, useValue: service },
    ],
  });
  const fixture = TestBed.createComponent(CancelEventDialog);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  const button = (name: string) =>
    Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.trim() === name)!;
  const type = (value: string) => {
    const message = host.querySelector('textarea')!;
    message.value = value;
    message.dispatchEvent(new Event('input'));
  };
  const settle = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
  };
  return { fixture, host, ref, service, button, type, settle };
}

describe('CancelEventDialog', () => {
  it('names the event and who will hear about it', () => {
    const { host } = setup(() => of(undefined));

    expect(host.textContent).toContain('Cancel Toronto Builders Night?');
    expect(host.textContent).toContain(
      'All 34 people who RSVP’d get an email; the 28 members also get an in-app notification. The event page stays up marked as cancelled.',
    );
    expect(host.querySelector('label')!.textContent).toContain('Message to attendees');
  });

  it('says so when no one has RSVP’d', () => {
    const { host } = setup(() => of(undefined), { ...data, rsvpCount: 0, memberCount: 0 });

    expect(host.textContent).toContain(
      'No one has RSVP’d yet. The event page stays up marked as cancelled.',
    );
  });

  it('asks for the reason inline before cancelling (AC3)', async () => {
    const { fixture, host, service, button } = setup(() => of(undefined));

    button('Cancel event').click();
    fixture.detectChanges();

    expect(service.cancelEvent).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Tell attendees why, so they aren’t left guessing.');
    expect(host.querySelector('textarea')!.getAttribute('aria-invalid')).toBe('true');
  });

  it('cancels with the trimmed reason and closes with true (AC1)', async () => {
    const { ref, service, button, type, settle } = setup(() => of(undefined));
    type('  Our venue fell through.  ');

    button('Cancel event').click();
    await settle();

    expect(service.cancelEvent).toHaveBeenCalledWith('e1', 'Our venue fell through.');
    expect(ref.close).toHaveBeenCalledWith(true);
  });

  it('keeps the event when Keep event is chosen', () => {
    const { ref, service, button } = setup(() => of(undefined));

    button('Keep event').click();

    expect(ref.close).toHaveBeenCalledWith(false);
    expect(service.cancelEvent).not.toHaveBeenCalled();
  });

  it('is busy with a read-only message while cancelling, then says nothing changed on failure', async () => {
    const pending = new Subject<void>();
    const { fixture, host, ref, button, type, settle } = setup(() => pending);
    type('Our venue fell through.');

    button('Cancel event').click();
    fixture.detectChanges();
    expect(host.querySelector('textarea')!.readOnly).toBe(true);
    expect(host.querySelector('button[aria-busy="true"]')!.textContent!.trim()).toBe(
      'Cancelling event…',
    );

    pending.error(new HttpErrorResponse({ status: 0 }));
    await settle();
    expect(host.textContent).toContain('Event not cancelled');
    expect(host.textContent).toContain(
      'We couldn’t reach FaithTech. Nothing was changed — try again.',
    );
    expect(ref.close).not.toHaveBeenCalled();
  });

  it('shows the server’s reason when it refuses, such as an event already cancelled', async () => {
    const { host, button, type, settle } = setup(() =>
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: { detail: 'This event is already cancelled.' },
          }),
      ),
    );
    type('Our venue fell through.');

    button('Cancel event').click();
    await settle();

    expect(host.textContent).toContain('This event is already cancelled.');
  });
});
