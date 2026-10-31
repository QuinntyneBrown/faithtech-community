import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  AUTH_SERVICE,
  ORGANISATION_SERVICE,
  OrganisationRole,
  ProfileDto,
  ProfileRole,
  PROFILES_SERVICE,
  ProfilesService,
  ROLES_SERVICE,
  SITE_SERVICE,
} from '@faithtech-community/api';
import { avatarColorFor, DialogService, RoleDialogData } from '@faithtech-community/components';
import { Observable, of, throwError } from 'rxjs';

import { ProfilePage } from './profile.page';

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
  description: `What a ${name} does`,
  chapterScopable: false,
}));
const held = (name: string): ProfileRole => ({
  id: ROLES.find((r) => r.name === name)!.id,
  name,
  chapterId: null,
});
const ids = (...names: string[]) => names.map((n) => held(n).id);

/** The callers by what the server says they may grant (L2-137 AC5). */
const CITY_LEAD = {
  grantable: ids(
    'Event Lead',
    'Create Lead',
    'Communications Lead',
    'Volunteer',
    'Product Engineer',
    'Attendee',
  ),
  capabilities: ['AssignRoles'],
  held: ['City Lead'],
};
const ADMIN = {
  grantable: ROLES.map((r) => r.id),
  capabilities: ['AdministerOrganisation'],
  held: ['System Admin'],
};
const NO_GRANTS = { grantable: [] as string[], capabilities: [] as string[], held: ['Event Lead'] };

const samuel: ProfileDto = {
  id: 'p1',
  name: 'Samuel Mensah',
  chapterId: 'c-toronto',
  chapterName: 'Toronto',
  bio: null,
  featuredPhoto: null,
  photos: [],
  roles: [held('Create Lead')],
  isOwn: false,
  canEdit: false,
};

function setup(getProfile: (id: string) => Observable<ProfileDto>, caller = NO_GRANTS) {
  const service: Partial<ProfilesService> = { getProfile: vi.fn(getProfile) };
  const roles = {
    addRole: vi.fn((_id: string, roleId: string) =>
      of<ProfileRole[]>([held('Create Lead'), held(ROLES.find((r) => r.id === roleId)!.name)]),
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
      { provide: SITE_SERVICE, useValue: FAITHTECH_SITE },
      { provide: PROFILES_SERVICE, useValue: service },
      { provide: ROLES_SERVICE, useValue: roles },
      {
        provide: AUTH_SERVICE,
        useValue: {
          grantableRoleIds: signal(caller.grantable),
          capabilities: signal(caller.capabilities),
          currentUser: signal({ roles: caller.held.map((name) => ({ name })) }),
        },
      },
      { provide: ORGANISATION_SERVICE, useValue: { get: () => of({ roles: ROLES }) } },
      { provide: DialogService, useValue: dialogs },
    ],
  });
  const fixture = TestBed.createComponent(ProfilePage);
  fixture.componentRef.setInput('id', 'p1');
  fixture.detectChanges();
  const host = fixture.nativeElement as HTMLElement;
  const button = (name: string) =>
    Array.from(host.querySelectorAll('button, a')).find((b) => b.textContent?.trim() === name) as
      HTMLElement | undefined;
  return { fixture, host, service, roles, dialogs, button, opened: () => opened! };
}

describe('ProfilePage', () => {
  it('tells an administrator the owner is not notified', async () => {
    const { fixture, button, opened } = setup(() => of(samuel), ADMIN);
    await fixture.whenStable();
    fixture.detectChanges();

    button('Add a role')!.click();
    expect(opened().options).toHaveLength(8);
    expect(opened().caption).toBe(
      'As an administrator you can grant any role. The change is recorded in the audit log, and Samuel isn’t notified.',
    );
  });

  it('shows role labels and no bio prompt on someone else’s profile', async () => {
    const { fixture, host } = setup(() => of(samuel));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(host.querySelector('h1')!.textContent).toContain('Samuel Mensah');
    expect(host.textContent).toContain('Create Lead');
    expect(host.textContent).not.toContain('You haven’t written a bio yet.');
    expect(host.textContent).not.toContain('Edit profile');
  });

  it('offers a System Admin Edit profile for another member, opening that member’s editor', async () => {
    // Traces to: L2-040 AC3
    const { fixture, button } = setup(() => of({ ...samuel, canEdit: true }), ADMIN);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(button('Edit profile')!.getAttribute('href')).toBe('/people/p1/edit');
  });

  it('links the owner to their own editor', async () => {
    const { fixture, button } = setup(() => of({ ...samuel, isOwn: true, canEdit: true }));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(button('Edit profile')!.getAttribute('href')).toBe('/people/me/edit');
  });

  it('draws the avatar in the colour that belongs to the member’s profile id', async () => {
    const { fixture, host } = setup(() => of(samuel));
    await fixture.whenStable();
    fixture.detectChanges();
    const avatar = host.querySelector('.ft-avatar')!;
    expect(avatar.classList.contains(`ft-avatar--${avatarColorFor('p1')}`)).toBe(true);
    expect(avatar.classList.contains('ft-avatar--plain')).toBe(false);
  });

  it('tells a 404 apart from a failure', async () => {
    const { fixture, host } = setup(() => throwError(() => new HttpErrorResponse({ status: 404 })));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(host.textContent).toContain('We can’t find that profile');
    expect(host.textContent).not.toContain('We couldn’t load this profile');
  });

  it('offers no role changes to a member who may grant nothing', async () => {
    const { fixture, button } = setup(() => of(samuel), NO_GRANTS);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(button('Add a role')).toBeUndefined();
    expect(button('Remove a role')).toBeUndefined();
  });

  it('lets a City Lead add a role they may grant and updates the badges without a reload', async () => {
    const { fixture, host, roles, dialogs, button, opened } = setup(() => of(samuel), CITY_LEAD);
    await fixture.whenStable();
    fixture.detectChanges();

    button('Add a role')!.click();
    const data = opened();
    expect(dialogs.open).toHaveBeenCalled();
    expect(data.mode).toBe('add');
    expect(data.options.map((o) => o.label)).toEqual([
      'Event Lead',
      'Communications Lead',
      'Volunteer',
      'Product Engineer',
      'Attendee',
    ]);
    expect(data.options[0].description).toBe('What a Event Lead does');
    expect(data.caption).toBe(
      'These are the roles your City Lead role may grant. An administrator can grant any role.',
    );
    expect(await data.submit(held('Volunteer').id)).toBeNull();
    fixture.detectChanges();

    expect(roles.addRole).toHaveBeenCalledWith('p1', held('Volunteer').id);
    expect(host.textContent).toContain('Volunteer');
  });

  it('lets a City Lead remove a role they may change', async () => {
    const { fixture, host, roles, button, opened } = setup(() => of(samuel), CITY_LEAD);
    await fixture.whenStable();
    fixture.detectChanges();

    button('Remove a role')!.click();
    expect(opened().mode).toBe('remove');
    expect(opened().options.map((o) => o.value)).toEqual([held('Create Lead').id]);
    await opened().submit(held('Create Lead').id);
    fixture.detectChanges();

    expect(roles.removeRole).toHaveBeenCalledWith('p1', held('Create Lead').id);
    expect(host.textContent).toContain('No role yet');
  });

  it('passes the server’s refusal back to the dialog', async () => {
    const { fixture, roles, button, opened } = setup(() => of(samuel), ADMIN);
    roles.removeRole.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: { detail: 'There must always be at least one administrator.' },
          }),
      ),
    );
    await fixture.whenStable();
    fixture.detectChanges();

    button('Remove a role')!.click();
    expect(await opened().submit(held('Create Lead').id)).toBe(
      'There must always be at least one administrator.',
    );
  });
});
