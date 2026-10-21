// Traces to: L2-019
import { TestBed } from '@angular/core/testing';
import {
  AUTH_SERVICE,
  Role,
  TEAM_SERVICE,
  TeamListDto,
  TeamMemberDto,
} from '@faithtech-community/api';
import { Observable, of, throwError } from 'rxjs';
import { signal } from '@angular/core';

import { TeamPage } from './team.page';

function member(overrides: Partial<TeamMemberDto>): TeamMemberDto {
  return {
    profileId: 'p1',
    name: 'Grace Okonkwo',
    homeCity: 'Toronto',
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
  cities: ['Austin', 'Toronto', 'Vancouver'],
};
const none: TeamListDto = { members: [], cities: [] };

async function setup(list: () => Observable<TeamListDto>, roles: Role[] = ['CityLead']) {
  const service = { list: vi.fn(list) };
  TestBed.configureTestingModule({
    providers: [
      { provide: TEAM_SERVICE, useValue: service },
      { provide: AUTH_SERVICE, useValue: { roles: signal(roles) } },
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

    expect(service.list).toHaveBeenCalledWith({ role: null, city: null });
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
    const { link } = await setup(() => of(everyone), ['Volunteer']);

    expect(link('Invite someone')).toBeUndefined();
  });

  it('filters by Leads or Volunteers with one chip pressed at a time', async () => {
    const { button, service, settle } = await setup(() => of(everyone));
    expect(button('All')!.getAttribute('aria-pressed')).toBe('true');

    button('Volunteers')!.click();
    await settle();

    expect(service.list).toHaveBeenLastCalledWith({ role: 'Volunteers', city: null });
    expect(button('Volunteers')!.getAttribute('aria-pressed')).toBe('true');
    expect(button('All')!.getAttribute('aria-pressed')).toBe('false');

    button('All')!.click();
    await settle();

    expect(service.list).toHaveBeenLastCalledWith({ role: null, city: null });
  });

  it('filters by a city chosen from every team member’s city', async () => {
    const { select, choose, service } = await setup(() => of(everyone));
    expect(Array.from(select().options).map((o) => o.textContent!.trim())).toEqual([
      'All cities',
      'Austin',
      'Toronto',
      'Vancouver',
    ]);

    await choose('Vancouver');

    expect(service.list).toHaveBeenLastCalledWith({ role: null, city: 'Vancouver' });
  });

  it('shows the empty state with an invite link when there is no team', async () => {
    const { host, link } = await setup(() => of(none));

    expect(host.querySelector('.ft-empty__title, h2')!.textContent).toContain('No team yet');
    expect(link('Invite someone')).toBeDefined();
  });

  it('says no one matches the filters and offers to show everyone', async () => {
    const lists = [everyone, everyone, { ...none, cities: everyone.cities }, everyone];
    const { host, button, choose, service, settle } = await setup(() => of(lists.shift()!));
    button('Volunteers')!.click();
    await choose('Vancouver');

    expect(host.textContent).toContain('No volunteers in Vancouver yet');
    expect(host.textContent).toContain('Try a different role or city.');

    button('Show everyone')!.click();
    await settle();

    expect(service.list).toHaveBeenLastCalledWith({ role: null, city: null });
    expect(button('All')!.getAttribute('aria-pressed')).toBe('true');
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
