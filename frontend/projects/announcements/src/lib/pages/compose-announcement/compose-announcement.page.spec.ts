// Traces to: L2-029
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  ANNOUNCEMENTS_SERVICE,
  AnnouncementAudience,
  AnnouncementSent,
  SendAnnouncementRequest,
} from '@faithtech-community/api';
import { Observable, of, Subject, throwError } from 'rxjs';

import { ComposeAnnouncementPage } from './compose-announcement.page';

function counts(audience: AnnouncementAudience): Observable<number> {
  if (audience.kind === 'Everyone') return of(612);
  return of((audience.roles ?? []).length * 20 + 1);
}

async function setup(
  send: () => Observable<AnnouncementSent> = () =>
    of({ id: 'a1', recipientCount: 41, emailCount: 38 }),
) {
  const service = {
    countRecipients: vi.fn(counts),
    send: vi.fn<(request: SendAnnouncementRequest) => Observable<AnnouncementSent>>(() => send()),
  };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: '**', children: [] }]),
      { provide: ANNOUNCEMENTS_SERVICE, useValue: service },
    ],
  });
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
    return (l.htmlFor ? host.querySelector(`#${l.htmlFor}`) : l.querySelector('input')) as
      HTMLInputElement | HTMLTextAreaElement;
  };
  const type = async (label: string, value: string) => {
    const input = field(label);
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await settle();
  };
  const check = async (label: string) => {
    field(label).click();
    await settle();
  };
  const button = (label: string) =>
    Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.trim().startsWith(label),
    );
  const submit = async () => {
    host.querySelector('form')!.dispatchEvent(new Event('submit'));
    await settle();
  };
  return { fixture, host, service, settle, field, type, check, button, submit };
}

describe('ComposeAnnouncementPage', () => {
  afterEach(() => document.body.replaceChildren());

  it('sends to everyone by default and shows the count before sending', async () => {
    const { host, button, service, field } = await setup();

    expect(host.querySelector('h1')!.textContent).toContain('New announcement');
    expect(service.countRecipients).toHaveBeenCalledWith({ kind: 'Everyone' });
    expect(host.textContent).toContain('612 members');
    expect(button('Send to 612 people')).toBeDefined();
    expect((field('Also send by email') as HTMLInputElement).checked).toBe(true);
    expect(host.querySelector('fieldset legend')!.textContent).toContain('Send to');
  });

  it('counts the holders of the chosen roles', async () => {
    const { check, button, service, host } = await setup();

    await check('People with a role');
    expect(host.textContent).toContain('Roles');
    await check('Volunteer');
    await check('Attendee');

    expect(service.countRecipients).toHaveBeenLastCalledWith({
      kind: 'Roles',
      roles: ['Volunteer', 'Attendee'],
    });
    expect(button('Send to 41 people')).toBeDefined();
  });

  it('shows inline errors for an empty subject and message and sends nothing', async () => {
    const { submit, host, service } = await setup();

    await submit();

    expect(service.send).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Fix 2 things to send');
    expect(host.textContent).toContain('Add a subject so people know what it’s about.');
    expect(host.textContent).toContain('Write a message of at least one sentence.');
  });

  it('asks for a role when sending to people with a role', async () => {
    const { submit, check, type, host, service } = await setup();
    await check('People with a role');
    await type('Subject', 'Hackathon');
    await type('Message', 'Teams are forming.');

    await submit();

    expect(service.send).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Choose at least one role.');
  });

  it('sends the announcement and says who got it', async () => {
    const { submit, type, check, service, host } = await setup();
    await check('People with a role');
    await check('Product Engineer');
    await type('Subject', ' November hackathon ');
    await type('Message', 'Team formation opens Monday.');

    await submit();

    expect(service.send).toHaveBeenCalledWith({
      subject: 'November hackathon',
      body: 'Team formation opens Monday.',
      audience: { kind: 'Roles', roles: ['ProductEngineer'] },
      alsoEmail: true,
    });
    expect(host.textContent).toContain('Sent to 41 people');
    expect(host.textContent).toContain(
      'It’s in their notifications now. 38 will also get it by email — 3 have opted out of announcement emails.',
    );
    const back = Array.from(host.querySelectorAll('a')).find((a) =>
      a.textContent?.includes('Back to announcements'),
    );
    expect(back!.getAttribute('href')).toBe('/announcements');
  });

  it('sends in the app only when email is off', async () => {
    const { submit, type, check, service, host } = await setup(() =>
      of({ id: 'a1', recipientCount: 612, emailCount: 0 }),
    );
    await type('Subject', 'In-app only');
    await type('Message', 'Hello.');
    await check('Also send by email');

    await submit();

    expect(service.send.mock.calls[0]![0].alsoEmail).toBe(false);
    expect(host.textContent).toContain('Sent to 612 people');
    expect(host.textContent).not.toContain('by email');
  });

  it('shows Sending… while busy and keeps the draft when sending fails', async () => {
    const pending = new Subject<AnnouncementSent>();
    let fail = false;
    const { submit, type, button, settle, host, field } = await setup(() =>
      fail ? throwError(() => new HttpErrorResponse({ status: 500 })) : pending,
    );
    await type('Subject', 'Builders Night');
    await type('Message', 'New place.');

    await submit();
    expect(button('Sending…')).toBeDefined();
    pending.error(new HttpErrorResponse({ status: 500 }));
    await settle();

    expect(host.textContent).toContain('Your announcement wasn’t sent');
    expect(field('Subject').value).toBe('Builders Night');
    fail = true;
  });

  it('shows the server’s field errors', async () => {
    const { submit, type, host } = await setup(() =>
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: { errors: { Subject: ['Use 150 characters or fewer for the subject.'] } },
          }),
      ),
    );
    await type('Subject', 'x');
    await type('Message', 'y');

    await submit();

    expect(host.textContent).toContain('Use 150 characters or fewer for the subject.');
  });
});
