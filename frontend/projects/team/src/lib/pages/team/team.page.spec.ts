// Traces to: L2-019
import { TestBed } from '@angular/core/testing';
import {
  AUTH_SERVICE,
  ChapterLabel,
  ORGANISATION_SERVICE,
  TEAM_SERVICE,
  TeamListDto,
  TeamMemberDto,
  Capability,
} from '@faithtech-community/api';
import { Observable, of, throwError } from 'rxjs';
import { signal } from '@angular/core';

import { TeamPage } from './team.page';

function member(overrides: Partial<TeamMemberDto>): TeamMemberDto {
  return {
    profileId: 'p1',
    name: 'Grace Okonkwo',
    chapterName: 'Toronto',
    photoUrl: 'https://photos.example/grace.jpg',
    roles: ['CityLead'],
    ...overrides,
  };
}

const grace = member({});
const samuel = member({
  profileId: 'p2',
  name: 'Samuel Mensah',
  photoUrl: null,
  roles: ['CreateLead', 'ProductEngineer'],
});
const everyone: TeamListDto = {
  members: [grace, samuel],
  next: null,
  totalCount: 2,
};
const none: TeamListDto = { members: [], next: null, totalCount: 0 };
const CITIES: ChapterLabel = { singular: 'City', plural: 'Cities' };

async function setup(
  list: (filters?: unknown, after?: string | null) => Observable<TeamListDto>,
  capabilities: Capability[] = ['InviteMembers'],
  chapterLabel: ChapterLabel | null = CITIES,
) {
  const organisation = {
    name: 'FaithTech Community',
    shortName: 'FaithTech',
    chapterLabel,
    chapters: chapterLabel
      ? [
          { id: 'c-toronto', name: 'Toronto' },
          { id: 'c-austin', name: 'Austin' },
          { id: 'c-vancouver', name: 'Vancouver' },
        ]
      : [],
    // The FaithTech seed's names for the role keys the members hold (L2-151).
    roles: [
      {
        id: 'role-CityLead',
        key: 'CityLead',
        name: 'City Lead',
        description: '',
        chapterScopable: false,
      },
      {
        id: 'role-EventLead',
        key: 'EventLead',
        name: 'Event Lead',
        description: '',
        chapterScopable: false,
      },
      {
        id: 'role-CreateLead',
        key: 'CreateLead',
        name: 'Create Lead',
        description: '',
        chapterScopable: false,
      },
      {
        id: 'role-CommunicationsLead',
        key: 'CommunicationsLead',
        name: 'Communications Lead',
        description: '',
        chapterScopable: false,
      },
      { id: 'role-Staff', key: 'Staff', name: 'Staff', description: '', chapterScopable: false },
      {
        id: 'role-Volunteer',
        key: 'Volunteer',
        name: 'Volunteer',
        description: '',
        chapterScopable: false,
      },
      {
        id: 'role-ProductEngineer',
        key: 'ProductEngineer',
        name: 'Product Engineer',
        description: '',
        chapterScopable: false,
      },
      {
        id: 'role-Attendee',
        key: 'Attendee',
        name: 'Attendee',
        description: '',
        chapterScopable: false,
      },
      {
        id: 'role-SystemAdmin',
        key: 'SystemAdmin',
        name: 'System Admin',
        description: '',
        chapterScopable: false,
      },
    ],
  };
  const service = { list: vi.fn(list) };
  TestBed.configureTestingModule({
    providers: [
      { provide: TEAM_SERVICE, useValue: service },
      { provide: AUTH_SERVICE, useValue: { capabilities: signal(capabilities) } },
      { provide: ORGANISATION_SERVICE, useValue: { get: () => of(organisation) } },
    ],
  });
  const fixture = TestBed.createComponent(TeamPage);
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  await settle();
  const host = fixture.nativeElement as HTMLElement;
  const button = (label: string) =>
    Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.trim() === label);
  const link = (label: string) =>
    Array.from(host.querySelectorAll('a')).find((a) => a.textContent?.trim() === label);
  const items = () => Array.from(host.querySelectorAll('ft-list-item'));
  const select = () => host.querySelector('select') as HTMLSelectElement;
  const choose = async (city: string) => {
    select().value = city;
    select().dispatchEvent(new Event('change'));
    await settle();
  };
  return { fixture, host, service, button, link, items, select, choose, settle };
}

describe('TeamPage', () => {
  it('lists every team member with a profile link, photo and role badges', async () => {
    const { host, items, service } = await setup(() => of(everyone));

    expect(service.list).toHaveBeenCalledWith({ role: null, chapterId: null });
    expect(host.querySelector('h1')!.textContent).toContain('Team');
    const [first, second] = items();
    const name = first.querySelector('a')!;
    expect(name.textContent).toBe('Grace Okonkwo');
    expect(name.getAttribute('href')).toBe('/people/p1');
    expect(first.querySelector('img')!.getAttribute('src')).toBe(
      'https://photos.example/grace.jpg',
    );
    expect(first.querySelector('ft-badge')!.textContent!.trim()).toBe('City Lead');
    expect(second.querySelector('img')).toBeNull();
    expect(
      Array.from(second.querySelectorAll('ft-badge')).map((b) => b.textContent!.trim()),
    ).toEqual(['Create Lead', 'Product Engineer']);
  });

  it('offers Invite someone to leads as a link to the invites page', async () => {
    const { link } = await setup(() => of(everyone));

    expect(link('Invite someone')!.getAttribute('href')).toBe('/invites');
  });

  it('hides Invite someone from members who are not leads', async () => {
    const { link } = await setup(() => of(everyone), ['JoinWorkspaces']);

    expect(link('Invite someone')).toBeUndefined();
  });

  it('filters by Leads or Volunteers with one chip pressed at a time', async () => {
    const { button, service, settle } = await setup(() => of(everyone));
    expect(button('All')!.getAttribute('aria-pressed')).toBe('true');

    button('Volunteers')!.click();
    await settle();

    expect(service.list).toHaveBeenLastCalledWith({ role: 'Volunteers', chapterId: null });
    expect(button('Volunteers')!.getAttribute('aria-pressed')).toBe('true');
    expect(button('All')!.getAttribute('aria-pressed')).toBe('false');

    button('All')!.click();
    await settle();

    expect(service.list).toHaveBeenLastCalledWith({ role: null, chapterId: null });
  });

  // Traces to: L2-142 AC1, AC2
  it('filters by a chapter chosen from the organisation’s chapters in order', async () => {
    const { host, select, choose, service } = await setup(() => of(everyone));
    expect(host.querySelector(`label[for="${select().id}"]`)!.textContent).toContain('City');
    expect(Array.from(select().options).map((o) => o.textContent!.trim())).toEqual([
      'All cities',
      'Toronto',
      'Austin',
      'Vancouver',
    ]);

    await choose('c-vancouver');

    expect(service.list).toHaveBeenLastCalledWith({ role: null, chapterId: 'c-vancouver' });
  });

  // Traces to: L2-142 AC3
  it('has no chapter filter while chapters are off', async () => {
    const { select, service } = await setup(() => of(everyone), ['InviteMembers'], null);

    expect(select()).toBeNull();
    expect(service.list).toHaveBeenLastCalledWith({ role: null, chapterId: null });
  });

  it('shows the empty state with an invite link when there is no team', async () => {
    const { host, link } = await setup(() => of(none));

    expect(host.querySelector('.ft-empty__title, h2')!.textContent).toContain('No team yet');
    expect(link('Invite someone')).toBeDefined();
  });

  it('says no one matches the filters and offers to show everyone', async () => {
    const lists = [everyone, everyone, none, everyone];
    const { host, button, choose, service, settle } = await setup(() => of(lists.shift()!));
    button('Volunteers')!.click();
    await choose('c-vancouver');

    expect(host.textContent).toContain('No volunteers in Vancouver yet');
    expect(host.textContent).toContain('Try a different role or city.');

    button('Show everyone')!.click();
    await settle();

    expect(service.list).toHaveBeenLastCalledWith({ role: null, chapterId: null });
    expect(button('All')!.getAttribute('aria-pressed')).toBe('true');
  });

  it('shows how many members match and loads the next page with Show more members', async () => {
    const ruth = member({ profileId: 'p3', name: 'Ruth Alvarez', roles: ['Volunteer'] });
    const { host, service, button, items, settle } = await setup((_filters, after) =>
      of(
        after
          ? { ...everyone, members: [ruth], totalCount: 3 }
          : { ...everyone, next: 'cursor-2', totalCount: 3 },
      ),
    );
    expect(host.textContent).toContain('Showing 2 of 3 members');

    button('Show more members')!.click();
    await settle();

    expect(service.list).toHaveBeenLastCalledWith({ role: null, chapterId: null }, 'cursor-2');
    expect(items()).toHaveLength(3);
    expect(host.textContent).toContain('Showing 3 of 3 members');
    expect(button('Show more members')).toBeUndefined();
  });

  it('keeps the members shown when the next page fails and lets the member try again', async () => {
    let fail = true;
    const ruth = member({ profileId: 'p3', name: 'Ruth Alvarez', roles: ['Volunteer'] });
    const { host, button, items, settle } = await setup((_filters, after) => {
      if (!after) return of({ ...everyone, next: 'cursor-2', totalCount: 3 });
      return fail
        ? throwError(() => new Error('offline'))
        : of({ ...everyone, members: [ruth], totalCount: 3 });
    });

    button('Show more members')!.click();
    await settle();
    expect(items()).toHaveLength(2);
    expect(host.querySelector('[role="alert"]')!.textContent).toContain(
      'We couldn’t load more members. Try again.',
    );

    fail = false;
    button('Show more members')!.click();
    await settle();
    expect(items()).toHaveLength(3);
    expect(host.querySelector('[role="alert"]')).toBeNull();
  });

  it('shows the error state and tries again', async () => {
    let fail = true;
    const { host, button, items, settle } = await setup(() =>
      fail ? throwError(() => new Error('offline')) : of(everyone),
    );
    expect(host.querySelector('[role="alert"]')!.textContent).toContain(
      'We couldn’t load the team',
    );

    fail = false;
    button('Try again')!.click();
    await settle();

    expect(items().length).toBe(2);
  });

  it('shows a labelled skeleton while loading', async () => {
    const { host } = await setup(() => new Observable<TeamListDto>());

    expect(host.querySelector('[aria-label="Loading team"]')).not.toBeNull();
  });
});
