// Traces to: L2-030 AC1
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ANNOUNCEMENTS_SERVICE,
  AUTH_SERVICE,
  AnnouncementDto,
  PagedResult,
  Role,
} from '@faithtech-community/api';
import { Observable, of, throwError } from 'rxjs';

import { AnnouncementsPage } from './announcements.page';

function announcement(overrides: Partial<AnnouncementDto>): AnnouncementDto {
  return {
    id: 'a1',
    subject: 'Builders Night moves to Kestrel Labs',
    body: 'Same time, new place.',
    sentAt: '2026-10-17T15:00:00Z',
    senderName: 'Hannah Kim',
    audience: { kind: 'Everyone', roles: [] },
    recipientCount: 612,
    ...overrides,
  };
}

function page(items: AnnouncementDto[], totalCount = items.length, n = 1) {
  return { items, page: n, pageSize: 20, totalCount } satisfies PagedResult<AnnouncementDto>;
}

async function setup(
  list: (page: number) => Observable<PagedResult<AnnouncementDto>>,
  roles: Role[] = ['Volunteer'],
) {
  const service = { list: vi.fn(list) };
  TestBed.configureTestingModule({
    providers: [
      { provide: ANNOUNCEMENTS_SERVICE, useValue: service },
      { provide: AUTH_SERVICE, useValue: { roles: signal(roles) } },
    ],
  });
  const fixture = TestBed.createComponent(AnnouncementsPage);
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  await settle();
  const host = fixture.nativeElement as HTMLElement;
  const items = () => Array.from(host.querySelectorAll('ft-list-item'));
  const button = (label: string) =>
    Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.trim() === label);
  const link = (label: string) =>
    Array.from(host.querySelectorAll('a')).find((a) => a.textContent?.trim() === label);
  return { host, service, settle, items, button, link };
}

describe('AnnouncementsPage', () => {
  it('lists the announcements sent to the member, newest first as the API orders them', async () => {
    const { host, items } = await setup(() =>
      of(
        page([
          announcement({
            subject: 'November hackathon',
            body: 'Teams are forming.',
            audience: { kind: 'Roles', roles: ['ProductEngineer', 'Volunteer'] },
            recipientCount: 41,
          }),
          announcement({ id: 'a2' }),
        ]),
      ),
    );

    expect(host.querySelector('h1')!.textContent).toContain('Announcements');
    const [first, second] = items();
    expect(first.querySelector('.ft-list-item__title')!.textContent).toContain(
      'November hackathon',
    );
    expect(first.textContent).toContain('To Product Engineers, Volunteers');
    expect(first.textContent).toContain('41 recipients');
    expect(first.querySelector('.ft-list-item__text')!.textContent).toBe('Teams are forming.');
    expect(second.textContent).toContain('To Everyone');
    expect(second.textContent).toContain('by Hannah Kim');
    expect(second.textContent).toMatch(/Sent \w{3} 17 Oct/);
  });

  it('offers New announcement only to Communications Leads and System Admins', async () => {
    const member = await setup(() => of(page([announcement({})])));
    expect(member.link('New announcement')).toBeUndefined();

    TestBed.resetTestingModule();
    const lead = await setup(() => of(page([announcement({})])), ['CommunicationsLead']);
    expect(lead.link('New announcement')!.getAttribute('href')).toBe('/announcements/new');
  });

  it('shows an empty state, with New announcement for senders', async () => {
    const member = await setup(() => of(page([])));
    expect(member.host.textContent).toContain('No announcements yet');
    expect(member.link('New announcement')).toBeUndefined();

    TestBed.resetTestingModule();
    const admin = await setup(() => of(page([])), ['SystemAdmin']);
    expect(admin.link('New announcement')).toBeDefined();
  });

  it('shows more announcements from the next page', async () => {
    const first = Array.from({ length: 20 }, (_, i) => announcement({ id: `a${i}` }));
    const { button, service, settle, items } = await setup((n) =>
      of(n === 1 ? page(first, 21) : page([announcement({ id: 'last' })], 21, 2)),
    );

    button('Show more announcements')!.click();
    await settle();

    expect(service.list).toHaveBeenLastCalledWith(2);
    expect(items()).toHaveLength(21);
    expect(button('Show more announcements')).toBeUndefined();
  });

  it('offers Try again when announcements cannot load', async () => {
    let fail = true;
    const { host, button, settle, items } = await setup(() =>
      fail ? throwError(() => new Error('offline')) : of(page([announcement({})])),
    );
    expect(host.textContent).toContain('We couldn’t load announcements');

    fail = false;
    button('Try again')!.click();
    await settle();

    expect(items()).toHaveLength(1);
  });
});
