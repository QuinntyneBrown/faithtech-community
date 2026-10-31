// Traces to: L2-053, L2-009, L2-137 AC5
import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  AUTH_SERVICE,
  Capability,
  ORGANISATION_SERVICE,
  OrganisationRole,
  PEOPLE_SERVICE,
  PagedResult,
  PersonSummary,
  ProfileRole,
  ROLES_SERVICE,
} from '@faithtech-community/api';
import { DialogService, RoleDialogData } from '@faithtech-community/components';
import { Observable, of, throwError } from 'rxjs';

import { PeoplePage } from './people.page';

const NAMES = [
  'City Lead',
  'Event Lead',
  'Create Lead',
  'Communications Lead',
  'Staff',
  'Volunteer',
  'Product Engineer',
  'Attendee',
  'System Admin',
];
const ROLES: OrganisationRole[] = NAMES.map((name, i) => ({
  id: `r${i + 1}`,
  key: name.replace(' ', ''),
  name,
  description: '',
  chapterScopable: false,
}));
const held = (name: string): ProfileRole => ({
  id: ROLES.find((r) => r.name === name)!.id,
  name,
  chapterId: null,
});
const ids = (...names: string[]) => names.map((n) => held(n).id);
// What FaithTech's rule lets a City Lead grant.
const CITY_LEAD_GRANTS = ids(
  'Event Lead',
  'Create Lead',
  'Communications Lead',
  'Volunteer',
  'Product Engineer',
  'Attendee',
);

function person(overrides: Partial<PersonSummary>): PersonSummary {
  return {
    id: 'p1',
    name: 'Grace Okonkwo',
    chapterName: 'Toronto',
    photoUrl: null,
    roles: [held('City Lead')],
    ...overrides,
  };
}

const grace = person({});
const marcus = person({
  id: 'p2',
  name: 'Marcus Lee',
  roles: [held('Event Lead')],
  photoUrl: 'https://photos.example/marcus.jpg',
});
const leah = person({ id: 'p3', name: 'Leah Thompson', roles: [] });

function page(items: PersonSummary[], totalCount = items.length): PagedResult<PersonSummary> {
  return { items, page: 1, pageSize: 25, totalCount };
}

async function setup(
  search: (
    term: string,
    page?: number,
    chapterId?: string | null,
  ) => Observable<PagedResult<PersonSummary>>,
  // L2-137 AC5: the server says which roles the caller may grant; the page offers exactly those.
  grantableRoleIds: string[] = CITY_LEAD_GRANTS,
  capabilities: Capability[] = ['AssignRoles', 'ViewPeopleDirectory'],
  chaptersOn = true,
) {
  const service = { search: vi.fn(search) };
  const roles = {
    addRole: vi.fn((_id: string, roleId: string) =>
      of<ProfileRole[]>(
        [held('Event Lead'), ROLES.find((r) => r.id === roleId)!].map((r) => held(r.name)),
      ),
    ),
    removeRole: vi.fn(() => of<ProfileRole[]>([])),
  };
  let opened: RoleDialogData | null = null;
  const dialogs = {
    open: vi.fn((_c: unknown, config: { data: RoleDialogData }) => {
      opened = config.data;
      return { closed: of(undefined) };
    }),
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: PEOPLE_SERVICE, useValue: service },
      { provide: ROLES_SERVICE, useValue: roles },
      {
        provide: AUTH_SERVICE,
        useValue: {
          capabilities: signal(capabilities),
          grantableRoleIds: signal(grantableRoleIds),
          currentUser: signal({ roles: [{ name: 'City Lead' }] }),
        },
      },
      {
        provide: ORGANISATION_SERVICE,
        useValue: {
          get: () =>
            of({
              name: 'FaithTech Community',
              shortName: 'FaithTech',
              chapterLabel: chaptersOn ? { singular: 'City', plural: 'Cities' } : null,
              chapters: chaptersOn
                ? [
                    { id: 'c-toronto', name: 'Toronto' },
                    { id: 'c-austin', name: 'Austin' },
                  ]
                : [],
              roles: ROLES,
            }),
        },
      },
      { provide: DialogService, useValue: dialogs },
    ],
  });
  const fixture = TestBed.createComponent(PeoplePage);
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  await settle();
  const host = fixture.nativeElement as HTMLElement;
  const rows = () => Array.from(host.querySelectorAll('tbody tr'));
  const row = (name: string) => rows().find((r) => r.textContent?.includes(name))!;
  const button = (scope: Element, name: string) =>
    Array.from(scope.querySelectorAll('button, a')).find(
      (b) => b.textContent?.replace(/\s+/g, ' ').trim() === name,
    ) as HTMLElement | undefined;
  const searchFor = async (term: string) => {
    const input = host.querySelector('input[type="search"]') as HTMLInputElement;
    input.value = term;
    input.dispatchEvent(new Event('input'));
    host.querySelector('form')!.dispatchEvent(new Event('submit'));
    await settle();
  };
  return {
    fixture,
    host,
    service,
    roles,
    dialogs,
    rows,
    row,
    button,
    searchFor,
    settle,
    opened: () => opened!,
  };
}

describe('PeoplePage', () => {
  it('lists members with a profile link, photo, role badges and city', async () => {
    const { host, row, service } = await setup(() => of(page([grace, marcus, leah])));

    expect(service.search).toHaveBeenCalledWith('', 1, null);
    expect(Array.from(host.querySelectorAll('th')).map((th) => th.textContent!.trim())).toContain(
      'City',
    );
    expect(host.querySelector('h1')!.textContent).toContain('People and roles');
    expect(host.querySelector('caption')!.textContent).toContain('Members and their roles');
    const link = row('Marcus Lee').querySelector('a')!;
    expect(link.getAttribute('href')).toBe('/people/p2');
    expect(row('Marcus Lee').querySelector('img')!.getAttribute('src')).toBe(
      'https://photos.example/marcus.jpg',
    );
    expect(row('Marcus Lee').textContent).toContain('Event Lead');
    expect(row('Marcus Lee').textContent).toContain('Toronto');
    expect(row('Leah Thompson').textContent).toContain('No role yet');
  });

  // Traces to: L2-142 AC1, AC2, AC5
  it('filters by a chapter from the organisation’s list and names it when no one matches', async () => {
    let answer = page([grace, marcus, leah]);
    const { host, service, fixture } = await setup(() => of(answer));
    const select = host.querySelector('select') as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.textContent!.trim())).toEqual([
      'All cities',
      'Toronto',
      'Austin',
    ]);

    answer = page([]);
    select.value = 'c-austin';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(service.search).toHaveBeenLastCalledWith('', 1, 'c-austin');
    expect(host.textContent).toContain('No one in Austin yet');
  });

  // Traces to: L2-142 AC3
  it('has no chapter filter or column while chapters are off', async () => {
    const { host } = await setup(
      () => of(page([grace, marcus, leah])),
      CITY_LEAD_GRANTS,
      ['AssignRoles', 'ViewPeopleDirectory'],
      false,
    );

    expect(host.querySelector('select')).toBeNull();
    expect(
      Array.from(host.querySelectorAll('th')).map((th) => th.textContent!.trim()),
    ).not.toContain('City');
  });

  it('gives a City Lead the actions their grant rule allows on each row', async () => {
    const { host, row, button } = await setup(() => of(page([grace, marcus, leah])));

    expect(host.textContent).toContain(
      'You can add or remove Event Lead, Create Lead, Communications Lead, Volunteer, Product Engineer and Attendee.',
    );
    expect(button(host, 'Invite someone')!.getAttribute('href')).toBe('/invites');
    expect(button(row('Marcus Lee'), 'Add role to Marcus Lee')).toBeDefined();
    expect(button(row('Marcus Lee'), 'Remove a role from Marcus Lee')).toBeDefined();
    expect(row('Marcus Lee').textContent).not.toContain('Only an administrator can change');
    expect(button(row('Grace Okonkwo'), 'Add role to Grace Okonkwo')).toBeDefined();
    expect(button(row('Grace Okonkwo'), 'Remove a role from Grace Okonkwo')).toBeUndefined();
    expect(row('Grace Okonkwo').textContent).toContain('Only an administrator can change');
    expect(button(row('Leah Thompson'), 'Remove a role from Leah Thompson')).toBeUndefined();
  });

  it('lets a System Admin change every role', async () => {
    const { host, row, button } = await setup(
      () => of(page([grace])),
      ROLES.map((r) => r.id),
      ['AdministerOrganisation'],
    );

    expect(host.textContent).toContain('As an administrator you can assign any role.');
    expect(button(row('Grace Okonkwo'), 'Remove a role from Grace Okonkwo')).toBeDefined();
    expect(row('Grace Okonkwo').textContent).not.toContain('Only an administrator can change');
  });

  it('shows Staff the list read-only', async () => {
    const { host, row, button } = await setup(
      () => of(page([grace, marcus])),
      [],
      ['ViewPeopleDirectory'],
    );

    expect(host.textContent).toContain('Read-only for Staff.');
    expect(button(host, 'Invite someone')).toBeUndefined();
    expect(row('Marcus Lee').querySelectorAll('button')).toHaveLength(0);
    expect(row('Grace Okonkwo').textContent).not.toContain('Only an administrator can change');
  });

  it('adds a role from a row and updates its badges without a reload', async () => {
    const { row, button, roles, opened, settle, service } = await setup(() => of(page([marcus])));

    button(row('Marcus Lee'), 'Add role to Marcus Lee')!.click();
    const data = opened();
    expect(data.mode).toBe('add');
    expect(data.name).toBe('Marcus Lee');
    expect(data.options.map((o) => o.label)).toEqual([
      'Create Lead',
      'Communications Lead',
      'Volunteer',
      'Product Engineer',
      'Attendee',
    ]);
    expect(await data.submit(held('Volunteer').id)).toBeNull();
    await settle();

    expect(roles.addRole).toHaveBeenCalledWith('p2', held('Volunteer').id);
    expect(row('Marcus Lee').textContent).toContain('Volunteer');
    expect(service.search).toHaveBeenCalledTimes(1);
  });

  it('removes a role from a row', async () => {
    const { row, button, roles, opened, settle } = await setup(() => of(page([marcus])));

    button(row('Marcus Lee'), 'Remove a role from Marcus Lee')!.click();
    expect(opened().mode).toBe('remove');
    expect(opened().options.map((o) => o.value)).toEqual([held('Event Lead').id]);
    await opened().submit(held('Event Lead').id);
    await settle();

    expect(roles.removeRole).toHaveBeenCalledWith('p2', held('Event Lead').id);
    expect(row('Marcus Lee').textContent).toContain('No role yet');
  });

  it('searches by the submitted term and offers an invite when no one matches', async () => {
    const { host, service, searchFor, button } = await setup((term) =>
      of(page(term ? [] : [grace])),
    );

    await searchFor(' xavier ');

    expect(service.search).toHaveBeenLastCalledWith('xavier', 1, null);
    expect(host.textContent).toContain('No one matches “xavier”');
    expect(host.textContent).toContain('They may not have joined yet.');
    expect(
      button(host.querySelector('ft-empty-state')!, 'Invite someone')!.getAttribute('href'),
    ).toBe('/invites');
  });

  it('shows more people a page at a time', async () => {
    const more = Array.from({ length: 25 }, (_, i) => person({ id: `m${i}`, name: `Member ${i}` }));
    const { host, service, button, rows, settle } = await setup((_t, p) =>
      of(p === 2 ? { ...page([leah], 26), page: 2 } : page(more, 26)),
    );

    expect(rows()).toHaveLength(25);
    button(host, 'Show more people')!.click();
    await settle();

    expect(service.search).toHaveBeenLastCalledWith('', 2, null);
    expect(rows()).toHaveLength(26);
    expect(button(host, 'Show more people')).toBeUndefined();
  });

  it('shows an error with a retry that loads again', async () => {
    let fail = true;
    const { host, button, settle, rows } = await setup(() =>
      fail ? throwError(() => new HttpErrorResponse({ status: 0 })) : of(page([grace])),
    );

    expect(host.textContent).toContain('We couldn’t load people');
    fail = false;
    button(host, 'Try again')!.click();
    await settle();

    expect(rows()).toHaveLength(1);
  });

  it('shows the forbidden page when the server refuses', async () => {
    const { host, button } = await setup(
      () => throwError(() => new HttpErrorResponse({ status: 403 })),
      [],
    );

    expect(host.querySelector('h1')!.textContent).toContain('People and roles');
    expect(host.textContent).toContain('Only City Leads manage roles');
    expect(host.textContent).toContain(
      'Ask your City Lead if someone needs a role added or removed.',
    );
    expect(button(host, 'Back to home')!.getAttribute('href')).toBe('/');
    expect(host.querySelector('input[type="search"]')).toBeNull();
  });
});
