// Traces to: L2-153, L2-169 AC3 (docs/detailed-designs/events/create-event-hub)
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { EVENT_HUBS_SERVICE } from '@faithtech-community/api';
import { Observable, of, throwError } from 'rxjs';

import { CreateEventHubData, CreateEventHubDialog } from './create-event-hub.dialog';

const data: CreateEventHubData = {
  eventId: 'e1',
  title: 'Toronto Builders Night',
  when: 'Fri 6 Nov, 6:30 pm to 9:00 pm',
  where: 'Kestrel Labs, Toronto',
  rsvpLink: 'http://localhost/public/events/e1',
};

function setup(create: () => Observable<{ id: string }> = () => of({ id: 'h1' })) {
  const ref = { close: vi.fn(), disableClose: false };
  const service = {
    create: vi.fn(create),
    get: vi.fn(),
    save: vi.fn((): Observable<void> => of(undefined)),
    templates: vi.fn(() => of([])),
    // Blank: every section shown (L2-169 AC3).
    start: vi.fn(() =>
      of({
        sections: ['Hero', 'Agenda', 'Venue', 'People', 'Links', 'Giving', 'UpcomingEvents'].map(
          (kind) => ({ kind, visible: true }),
        ),
      }),
    ),
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: DIALOG_DATA, useValue: data },
      { provide: DialogRef, useValue: ref },
      { provide: EVENT_HUBS_SERVICE, useValue: service },
    ],
  });
  const fixture = TestBed.createComponent(CreateEventHubDialog);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  const button = (name: string) =>
    Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.trim() === name);
  const settle = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const status = () => host.querySelector('.ft-stepper__status')?.textContent ?? '';
  return { fixture, host, ref, service, button, settle, status };
}

describe('CreateEventHubDialog', () => {
  it('opens on step 1 with the event’s facts read from the event', () => {
    const { host, status, button } = setup();

    expect(status()).toContain('Step 1 of 4');
    expect(host.textContent).toContain('Which event is this hub for?');
    expect(host.textContent).toContain('Kestrel Labs, Toronto');
    expect(button('Back')).toBeUndefined();
  });

  it('creates the hub on the first Next and saves the sections on later ones', async () => {
    const { button, settle, service, status, host } = setup();

    button('Next')!.click();
    await settle();
    expect(service.create).toHaveBeenCalledWith('e1');
    expect(status()).toContain('Step 2 of 4');

    button('Next')!.click();
    await settle();
    const giving = Array.from(host.querySelectorAll<HTMLInputElement>('input[type=checkbox]')).find(
      (c) => c.value === 'Giving',
    )!;
    giving.click();
    button('Next')!.click();
    await settle();

    expect(service.create).toHaveBeenCalledTimes(1);
    const request = service.save.mock.calls.at(-1) as unknown as [
      string,
      { sections: { kind: string; visible: boolean }[] },
    ];
    expect(request[1].sections.find((s) => s.kind === 'Giving')?.visible).toBe(false);
    expect(status()).toContain('Step 4 of 4');
  });

  it('closes with a draft on Save and finish later', async () => {
    const { button, settle, ref } = setup();

    button('Save and finish later')!.click();
    await settle();

    expect(ref.close).toHaveBeenCalledWith({ created: true, next: 'later' });
  });

  it('shows the server’s refusal on the step', async () => {
    const { button, settle, host, status } = setup(() =>
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: { detail: 'This event already has a hub.' },
          }),
      ),
    );

    button('Next')!.click();
    await settle();

    expect(host.querySelector('[role=alert]')?.textContent).toContain(
      'This event already has a hub.',
    );
    expect(status()).toContain('Step 1 of 4');
  });

  it('offers Try again when the save fails', async () => {
    let fail = true;
    const { button, settle, host, status } = setup(() =>
      fail ? throwError(() => new HttpErrorResponse({ status: 500 })) : of({ id: 'h1' }),
    );

    button('Next')!.click();
    await settle();
    expect(host.textContent).toContain('We couldn’t save your hub');

    fail = false;
    button('Try again')!.click();
    await settle();
    expect(status()).toContain('Step 2 of 4');
  });
});
