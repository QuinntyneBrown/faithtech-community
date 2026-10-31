// Traces to: L2-029
import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import {
  ANNOUNCEMENTS_SERVICE,
  AUTH_SERVICE,
  AnnouncementAudience,
  EVENTS_SERVICE,
  EventSummaryDto,
  SendAnnouncementRequest,
  Capability,
} from '@faithtech-community/api';
import { Observable, of, throwError } from 'rxjs';

import { ComposeAnnouncementPage } from './compose-announcement.page';

const builders: EventSummaryDto = {
  id: 'e1',
  title: 'Toronto Builders Night',
  type: 'BuildersNight',
  startsAt: '2026-11-06T18:00:00Z',
  endsAt: '2026-11-06T21:00:00Z',
  city: 'Toronto',
  format: 'InPerson',
  venue: 'Kestrel Labs',
  visibility: 'MembersOnly',
  rsvpCount: 34,
  isCancelled: false,
};

const COUNTS: Record<string, number> = { Everyone: 612, Roles: 41, EventRsvps: 34 };

async function setup(
  options: {
    capabilities?: Capability[];
    send?: (r: SendAnnouncementRequest) => Observable<unknown>;
  } = {},
) {
  const service = {
    countRecipients: vi.fn((a: AnnouncementAudience) => of(COUNTS[a.kind])),
    send: vi.fn(options.send ?? (() => of({ id: 'a1', recipientCount: 41, emailCount: 38 }))),
    list: vi.fn(),
    setEmailOptOut: vi.fn(),
    unsubscribe: vi.fn(),
  };
  const events = { listEvents: vi.fn(() => of({ events: [builders], cities: [] })) };
  TestBed.configureTestingModule({
    providers: [
      { provide: ANNOUNCEMENTS_SERVICE, useValue: service },
      { provide: EVENTS_SERVICE, useValue: events },
      {
        provide: AUTH_SERVICE,
        useValue: { capabilities: signal(options.capabilities ?? ['SendAnnouncements']) },
      },
    ],
  });
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  const fixture = TestBed.createComponent(ComposeAnnouncementPage);
  document.body.appendChild(fixture.nativeElement);
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  await settle();
  const host = fixture.nativeElement as HTMLElement;
  const field = (label: string) => {
    const l = Array.from(host.querySelectorAll('label')).find((x) =>
      x.textContent?.trim().startsWith(label),
    )!;
    return host.querySelector<HTMLInputElement>(`#${l.htmlFor}`)!;
  };
  const type = async (label: string, value: string) => {
    const input = field(label);
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await settle();
  };
  const radio = async (text: string) => {
    const option = Array.from(host.querySelectorAll('input[type="radio"]')).find((r) =>
      r.closest('label')?.textContent?.includes(text),
    ) as HTMLInputElement;
    option.click();
    await settle();
  };
  const check = async (text: string) => {
    const box = Array.from(host.querySelectorAll('input[type="checkbox"]')).find(
      (r) => r.closest('label')?.textContent?.trim() === text,
    ) as HTMLInputElement;
    box.click();
    await settle();
  };
  const sendButton = () =>
    Array.from(host.querySelectorAll('button[type="submit"]'))[0] as HTMLButtonElement;
  const submit = async () => {
    sendButton().click();
    await settle();
  };
  return {
    fixture,
    host,
    service,
    events,
    navigate,
    type,
    radio,
    check,
    sendButton,
    submit,
    settle,
  };
}

describe('ComposeAnnouncementPage', () => {
  afterEach(() => document.body.replaceChildren());

  it('shows how many people the chosen audience reaches before sending', async () => {
    const { host, sendButton, radio, check, service } = await setup();

    expect(host.querySelector('h1')!.textContent).toContain('New announcement');
    expect(host.textContent).toContain('612 members');
    expect(sendButton().textContent).toContain('Send to 612 people');

    await radio('People with a role');
    await check('Volunteer');
    await check('Product Engineer');

    expect(service.countRecipients).toHaveBeenLastCalledWith({
      kind: 'Roles',
      roles: ['Volunteer', 'ProductEngineer'],
    });
    expect(sendButton().textContent).toContain('Send to 41 people');
  });

  it('lists upcoming events for an RSVP audience and counts their RSVPs', async () => {
    const { host, radio, events, service, sendButton, settle } = await setup();

    await radio('An event’s RSVP list');
    const select = host.querySelector('select') as HTMLSelectElement;
    expect(events.listEvents).toHaveBeenCalledWith({ filter: 'Upcoming' });
    expect(Array.from(select.options).map((o) => o.textContent?.trim())).toContain(
      'Toronto Builders Night · Fri 6 Nov',
    );
    select.value = 'e1';
    select.dispatchEvent(new Event('change'));
    await settle();

    expect(service.countRecipients).toHaveBeenLastCalledWith({ kind: 'EventRsvps', eventId: 'e1' });
    expect(sendButton().textContent).toContain('Send to 34 people');
  });

  it('shows inline errors for an empty subject and message and sends nothing', async () => {
    const { host, submit, service } = await setup();

    await submit();

    expect(service.send).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Fix 2 things to send');
    expect(host.textContent).toContain('Add a subject so people know what it’s about.');
    expect(host.textContent).toContain('Write a message of at least one sentence.');
    expect(host.querySelectorAll('[aria-invalid="true"]').length).toBeGreaterThanOrEqual(2);
  });

  it('asks for a role when sending to people with a role', async () => {
    const { host, radio, type, submit, service } = await setup();
    await radio('People with a role');
    await type('Subject', 'Hackathon teams');
    await type('Message', 'Teams form on Monday.');

    await submit();

    expect(service.send).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Choose at least one role.');
  });

  it('sends with Also send by email on by default and shows who it reached', async () => {
    const { host, type, submit, service } = await setup();
    await type('Subject', 'Welcome');
    await type('Message', 'Welcome to the new site.');

    await submit();

    expect(service.send).toHaveBeenCalledWith({
      subject: 'Welcome',
      body: 'Welcome to the new site.',
      alsoEmail: true,
      audience: { kind: 'Everyone' },
    });
    expect(host.textContent).toContain('Sent to 41 people');
    expect(host.textContent).toContain(
      '38 will also get it by email — 3 have opted out of announcement emails.',
    );
  });

  it('sends in the app only when Also send by email is turned off', async () => {
    const { host, type, submit, service } = await setup({
      send: () => of({ id: 'a1', recipientCount: 12, emailCount: 0 }),
    });
    await type('Subject', 'Welcome');
    await type('Message', 'Welcome to the new site.');
    (host.querySelector('input[role="switch"]') as HTMLInputElement).click();

    await submit();

    expect(service.send.mock.calls[0][0].alsoEmail).toBe(false);
    expect(host.textContent).not.toContain('by email');
  });

  it('keeps the draft and says nothing went out when sending fails', async () => {
    const { host, type, submit } = await setup({
      send: () => throwError(() => new HttpErrorResponse({ status: 500 })),
    });
    await type('Subject', 'Welcome');
    await type('Message', 'Welcome to the new site.');

    await submit();

    expect(host.textContent).toContain('Your announcement wasn’t sent');
    expect((host.querySelector('input[type="text"]') as HTMLInputElement).value).toBe('Welcome');
  });

  it('shows the server’s field errors', async () => {
    const { host, type, submit } = await setup({
      send: () =>
        throwError(
          () =>
            new HttpErrorResponse({
              status: 400,
              error: { errors: { Subject: ['Use 200 characters or fewer for the subject.'] } },
            }),
        ),
    });
    await type('Subject', 'x');
    await type('Message', 'y');

    await submit();

    expect(host.textContent).toContain('Use 200 characters or fewer for the subject.');
  });

  it('sends anyone who may not send announcements to the forbidden page', async () => {
    const { navigate } = await setup({ capabilities: ['ManageEvents'] });

    expect(navigate).toHaveBeenCalledWith('/forbidden');
  });
});
