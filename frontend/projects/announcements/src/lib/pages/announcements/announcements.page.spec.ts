// Traces to: L2-030
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  AnnouncementDto,
  ANNOUNCEMENTS_SERVICE,
  AUTH_SERVICE,
  PagedResult,
  SITE_SERVICE,
  Capability,
} from '@faithtech-community/api';
import { Observable, of, throwError } from 'rxjs';

import { AnnouncementsPage } from './announcements.page';

/** The host's organisation the copy names, as GET /api/site answers it on FaithTech's host. */
const FAITHTECH_SITE = {
  site: () => ({
    name: 'FaithTech Community',
    shortName: 'FaithTech',
    chapterLabel: { singular: 'City', plural: 'Cities' },
    communityOrigin: 'http://localhost:4200',
  }),
  load: async () => undefined,
};

function announcement(id: string, overrides: Partial<AnnouncementDto> = {}): AnnouncementDto {
  return {
    id,
    subject: `Subject ${id}`,
    body: `Body ${id}`,
    sentAt: '2026-10-20T15:00:00Z',
    senderName: 'Hannah Kim',
    audienceKind: 'Everyone',
    roles: [],
    eventTitle: null,
    recipientCount: 612,
    ...overrides,
  };
}

function page(items: AnnouncementDto[], extra: Partial<PagedResult<AnnouncementDto>> = {}) {
  return { items, page: 1, pageSize: 25, totalCount: items.length, ...extra };
}

async function setup(
  list: (page: number) => Observable<PagedResult<AnnouncementDto>>,
  capabilities: Capability[] = [],
) {
  const service = { list: vi.fn(list) };
  TestBed.configureTestingModule({
    providers: [
      { provide: SITE_SERVICE, useValue: FAITHTECH_SITE },
      { provide: ANNOUNCEMENTS_SERVICE, useValue: service },
      { provide: AUTH_SERVICE, useValue: { capabilities: signal(capabilities) } },
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
  return { fixture, host, service, items, button, settle };
}

describe('AnnouncementsPage', () => {
  it('lists the announcements sent to the member, newest first, with who sent them to whom', async () => {
    const { host, items } = await setup(() =>
      of(
        page([
          announcement('b', {
            subject: 'November hackathon: teams are forming',
            body: 'Team formation opens Monday.',
            audienceKind: 'Roles',
            roles: ['ProductEngineer'],
            recipientCount: 41,
          }),
          announcement('a', {
            audienceKind: 'EventRsvps',
            eventTitle: 'Toronto Builders Night',
            sentAt: '2026-10-17T15:00:00Z',
            recipientCount: 1,
          }),
        ]),
      ),
    );

    expect(host.querySelector('h1')!.textContent).toContain('Announcements');
    const [first, second] = items();
    expect(first.textContent).toContain('November hackathon: teams are forming');
    expect(first.textContent).toContain('Team formation opens Monday.');
    expect(first.textContent).toContain(
      'To Product Engineers · Sent Tue 20 Oct by Hannah Kim · 41 recipients',
    );
    expect(second.textContent).toContain('To RSVPs: Toronto Builders Night');
    expect(second.textContent).toContain('1 recipient');
  });

  it('offers New announcement only to those who may send', async () => {
    const member = await setup(() => of(page([announcement('a')])));
    expect(member.host.querySelector('a[href="/announcements/new"]')).toBeNull();
    TestBed.resetTestingModule();

    const lead = await setup(() => of(page([announcement('a')])), ['SendAnnouncements']);
    expect(lead.host.querySelector('a[href="/announcements/new"]')).not.toBeNull();
  });

  it('shows the empty state when there are none', async () => {
    const { host } = await setup(() => of(page([])));

    expect(host.textContent).toContain('No announcements yet');
  });

  it('appends older announcements', async () => {
    const first = Array.from({ length: 25 }, (_, i) => announcement(`n${i}`));
    const { items, button, settle, service } = await setup((p) =>
      p === 2
        ? of(page([announcement('last')], { page: 2, totalCount: 26 }))
        : of(page(first, { totalCount: 26 })),
    );

    button('Show older announcements')!.click();
    await settle();

    expect(service.list).toHaveBeenLastCalledWith(2);
    expect(items()).toHaveLength(26);
    expect(button('Show older announcements')).toBeUndefined();
  });

  it('offers Try again when the list fails to load', async () => {
    let fail = true;
    const { host, button, settle, items } = await setup(() =>
      fail ? throwError(() => new Error('offline')) : of(page([announcement('a')])),
    );
    expect(host.textContent).toContain('We couldn’t load announcements');

    fail = false;
    button('Try again')!.click();
    await settle();

    expect(items()).toHaveLength(1);
  });
});
