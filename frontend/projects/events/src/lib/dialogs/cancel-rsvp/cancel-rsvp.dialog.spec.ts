// Traces to: L2-022 AC2
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { EVENTS_SERVICE } from '@faithtech-community/api';
import { Observable, Subject, of, throwError } from 'rxjs';

import { CancelRsvpData, CancelRsvpDialog } from './cancel-rsvp.dialog';

const data: CancelRsvpData = { eventId: 'e1', hostName: 'Marcus Lee' };

function setup(cancelRsvp: (id: string) => Observable<void>, dialogData = data) {
  const ref = { close: vi.fn(), disableClose: false };
  const service = { cancelRsvp: vi.fn(cancelRsvp) };
  TestBed.configureTestingModule({
    providers: [
      { provide: DIALOG_DATA, useValue: dialogData },
      { provide: DialogRef, useValue: ref },
      { provide: EVENTS_SERVICE, useValue: service },
    ],
  });
  const fixture = TestBed.createComponent(CancelRsvpDialog);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  const button = (name: string) =>
    Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.trim() === name)!;
  const settle = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
  };
  return { fixture, host, ref, service, button, settle };
}

describe('CancelRsvpDialog', () => {
  it('asks to confirm, naming the host and that they can RSVP again', () => {
    const { host, button } = setup(() => of(undefined));

    expect(host.textContent).toContain('Cancel your RSVP?');
    expect(host.textContent).toContain(
      'Marcus will see one fewer person coming. You can RSVP again any time before the event.',
    );
    expect(button('Keep my RSVP')).toBeTruthy();
    expect(button('Cancel my RSVP')).toBeTruthy();
  });

  it('speaks of the hosts when the host is unknown', () => {
    const { host } = setup(() => of(undefined), { eventId: 'e1', hostName: null });

    expect(host.textContent).toContain('The hosts will see one fewer person coming.');
  });

  it('keeps the RSVP when Keep my RSVP is chosen', () => {
    const { ref, service, button } = setup(() => of(undefined));

    button('Keep my RSVP').click();

    expect(ref.close).toHaveBeenCalledWith(false);
    expect(service.cancelRsvp).not.toHaveBeenCalled();
  });

  it('cancels the RSVP and closes with true', async () => {
    const { ref, service, button, settle } = setup(() => of(undefined));

    button('Cancel my RSVP').click();
    await settle();

    expect(service.cancelRsvp).toHaveBeenCalledWith('e1');
    expect(ref.close).toHaveBeenCalledWith(true);
  });

  it('is busy while cancelling, then says nothing changed when it fails', async () => {
    const pending = new Subject<void>();
    const { fixture, host, ref, button, settle } = setup(() => pending);

    button('Cancel my RSVP').click();
    fixture.detectChanges();
    expect(host.querySelector('button[aria-busy="true"]')!.textContent!.trim()).toBe(
      'Cancelling your RSVP…',
    );

    pending.error(new Error('offline'));
    await settle();
    expect(host.textContent).toContain('RSVP not cancelled');
    expect(host.textContent).toContain(
      'We couldn’t reach FaithTech. Nothing was changed — try again.',
    );
    expect(ref.close).not.toHaveBeenCalled();
  });

  it('closes as done when the RSVP was already gone', async () => {
    const { ref, button, settle } = setup(() =>
      throwError(() => new HttpErrorResponse({ status: 404 })),
    );

    button('Cancel my RSVP').click();
    await settle();

    expect(ref.close).toHaveBeenCalledWith(true);
  });
});
