import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  AUTH_SERVICE,
  PROFILES_SERVICE,
  ProfileDto,
  ProfilesService,
  ROLES_SERVICE,
  Role,
} from '@faithtech-community/api';
import { avatarColorFor, DialogService, RoleDialogData } from '@faithtech-community/components';
import { Observable, of, throwError } from 'rxjs';

import { ProfilePage } from './profile.page';

const samuel: ProfileDto = {
  id: 'p1',
  name: 'Samuel Mensah',
  homeCity: 'Toronto',
  bio: null,
  featuredPhoto: null,
  photos: [],
  roles: ['CreateLead'],
  isOwn: false,
  canEdit: false,
};

function setup(getProfile: (id: string) => Observable<ProfileDto>, callerRoles: Role[] = []) {
  const service: Partial<ProfilesService> = { getProfile: vi.fn(getProfile) };
  const roles = {
    addRole: vi.fn((_id: string, role: Role) => of<Role[]>(['CreateLead', role])),
    removeRole: vi.fn(() => of<Role[]>([])),
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
      { provide: PROFILES_SERVICE, useValue: service },
      { provide: ROLES_SERVICE, useValue: roles },
      { provide: AUTH_SERVICE, useValue: { roles: signal(callerRoles) } },
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
    const { fixture, button } = setup(() => of({ ...samuel, canEdit: true }), ['SystemAdmin']);
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

  it('offers no role changes to a member without City Lead or System Admin', async () => {
    const { fixture, button } = setup(() => of(samuel), ['EventLead']);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(button('Add a role')).toBeUndefined();
    expect(button('Remove a role')).toBeUndefined();
  });

  it('lets a City Lead add a role they may grant and updates the badges without a reload', async () => {
    const { fixture, host, roles, dialogs, button, opened } = setup(() => of(samuel), ['CityLead']);
    await fixture.whenStable();
    fixture.detectChanges();

    button('Add a role')!.click();
    const data = opened();
    expect(dialogs.open).toHaveBeenCalled();
    expect(data.mode).toBe('add');
    expect(data.options.map((o) => o.value)).toEqual([
      'EventLead',
      'CommunicationsLead',
      'Volunteer',
      'ProductEngineer',
      'Attendee',
    ]);
    expect(await data.submit('Volunteer')).toBeNull();
    fixture.detectChanges();

    expect(roles.addRole).toHaveBeenCalledWith('p1', 'Volunteer');
    expect(host.textContent).toContain('Volunteer');
  });

  it('lets a City Lead remove a role they may change', async () => {
    const { fixture, host, roles, button, opened } = setup(() => of(samuel), ['CityLead']);
    await fixture.whenStable();
    fixture.detectChanges();

    button('Remove a role')!.click();
    expect(opened().mode).toBe('remove');
    expect(opened().options.map((o) => o.value)).toEqual(['CreateLead']);
    await opened().submit('CreateLead');
    fixture.detectChanges();

    expect(roles.removeRole).toHaveBeenCalledWith('p1', 'CreateLead');
    expect(host.textContent).toContain('No role yet');
  });

  it('passes the server’s refusal back to the dialog', async () => {
    const { fixture, roles, button, opened } = setup(() => of(samuel), ['SystemAdmin']);
    roles.removeRole.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: { detail: 'There must always be at least one System Admin.' },
          }),
      ),
    );
    await fixture.whenStable();
    fixture.detectChanges();

    button('Remove a role')!.click();
    expect(await opened().submit('CreateLead')).toBe(
      'There must always be at least one System Admin.',
    );
  });
});
