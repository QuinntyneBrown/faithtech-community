// Traces to: L2-019 (docs/detailed-designs/team/team-list)
import { expect, test } from '../../fixtures/app';
import { MockApi, photoUrl } from '../../fixtures/mock-api';
import { TeamPage } from '../../pages/team.page';

function addTeam(api: MockApi) {
  const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
  const profile = api.profiles.get(grace.profileId)!;
  profile.chapterId = api.chapters.named('Toronto').id;
  profile.photos.push({
    id: 'photo-1',
    url: photoUrl('#0b7285'),
    altText: 'Grace speaking at Builders Night',
    isFeatured: true,
    uploadedAt: '2026-10-01T09:00:00Z',
  });
  api.addProfile({
    name: 'Marcus Lee',
    chapterId: api.chapters.named('Austin').id,
    roles: ['EventLead'],
  });
  api.addProfile({
    name: 'Samuel Mensah',
    chapterId: api.chapters.named('Toronto').id,
    roles: ['CreateLead', 'ProductEngineer'],
  });
  const ruth = api.addProfile({
    name: 'Ruth Alvarez',
    chapterId: api.chapters.named('Toronto').id,
    roles: ['Volunteer'],
  });
  api.addProfile({
    name: 'Nate Oyelaran',
    chapterId: api.chapters.named('Vancouver').id,
    roles: ['ProductEngineer'],
  });
  return { grace, ruth };
}

test.describe('Team list', () => {
  test('a member sees every lead and volunteer with photo and roles', async ({
    page,
    api,
    axe,
  }) => {
    addTeam(api);
    const leah = api.addAccount({
      email: 'leah@example.org',
      name: 'Leah Thompson',
      roles: ['Attendee'],
    });
    const team = new TeamPage(page);
    await api.signInAs(leah, '/team');

    await expect(team.heading).toHaveText('Team');
    await expect
      .poll(() => team.names())
      .toEqual(['Grace Okonkwo', 'Marcus Lee', 'Ruth Alvarez', 'Samuel Mensah']);
    await expect(team.photo('Grace Okonkwo')).toBeVisible();
    await expect(team.photo('Marcus Lee')).toHaveCount(0);
    await expect(team.member('Samuel Mensah')).toContainText('Create Lead');
    await expect(team.member('Samuel Mensah')).toContainText('Product Engineer');
    await expect(team.inviteSomeone).toHaveCount(0);
    await axe.check();
    await page.emulateMedia({ colorScheme: 'dark' });
    await axe.check();

    await team.profileLink('Ruth Alvarez').click();
    await expect(page).toHaveURL(/\/people\/profile-\d+$/);
  });

  test('a lead filters by role and city and gets back to everyone', async ({ page, api, axe }) => {
    const { grace } = addTeam(api);
    const team = new TeamPage(page);
    await api.signInAs(grace, '/team');
    await expect(team.inviteSomeone).toHaveAttribute('href', '/invites');

    await team.roleFilter('Leads').click();
    await expect(team.roleFilter('Leads')).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => team.names()).toEqual(['Grace Okonkwo', 'Marcus Lee', 'Samuel Mensah']);

    await team.city.selectOption('Toronto');
    await expect.poll(() => team.names()).toEqual(['Grace Okonkwo', 'Samuel Mensah']);

    await team.roleFilter('Volunteers').click();
    await team.city.selectOption('Austin');
    await expect(team.noResults('No volunteers in Austin yet')).toBeVisible();
    await axe.check();

    await team.showEveryone.click();
    await expect(team.roleFilter('All')).toHaveAttribute('aria-pressed', 'true');
    await expect(team.city).toHaveValue('');
    await expect(team.members).toHaveCount(4);
  });

  test('a profile that loses its last team role drops off the team', async ({ page, api }) => {
    const { grace, ruth } = addTeam(api);
    const team = new TeamPage(page);
    await api.signInAs(grace, '/team');
    await expect(team.member('Ruth Alvarez')).toBeVisible();

    ruth.roles = ['Attendee'];
    await team.open();

    await expect(team.members).toHaveCount(3);
    await expect(team.member('Ruth Alvarez')).toHaveCount(0);
  });

  test('shows the empty, loading and error states', async ({ page, api, axe }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['Attendee'] });
    const team = new TeamPage(page);
    await api.signInAs(grace, '/team');
    await expect(team.empty).toBeVisible();
    await axe.check();

    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => (release = resolve));
    let fail = true;
    api.on('GET', '/api/team', async (route) => {
      if (fail) {
        await held;
        return route.abort('failed');
      }
      return api.fallback(route);
    });
    await team.open();
    await expect(team.skeleton).toBeVisible();
    release();
    await expect(team.loadError).toBeVisible();
    await axe.check();

    fail = false;
    await team.tryAgain.click();
    await expect(team.empty).toBeVisible();
  });

  test('anonymous visitors are sent to sign in', async ({ page }) => {
    const team = new TeamPage(page);
    await team.open();

    await expect(page).toHaveURL(/\/sign-in/);
  });
  test('a large team is shown 50 at a time, filtered before paging, with Show more members', async ({
    page,
    api,
    axe,
  }) => {
    for (let i = 0; i < 70; i++) {
      const account = api.addAccount({
        email: `member${i}@example.org`,
        name: `Member ${String(i).padStart(3, '0')}`,
        roles: [i % 2 === 0 ? 'Volunteer' : 'EventLead'],
      });
      api.profiles.get(account.profileId)!.chapterId = api.chapters.named(
        i < 60 ? 'Toronto' : 'Halifax',
      ).id;
    }
    const viewer = api.addAccount({ email: 'leah@example.org', name: 'Leah Thompson' });
    const team = new TeamPage(page);
    await api.signInAs(viewer, '/team');

    await expect(team.members).toHaveCount(50);
    await expect(team.count).toHaveText('Showing 50 of 70 members');
    await expect(team.city.locator('option', { hasText: 'Halifax' })).toHaveCount(1);
    await axe.check();

    let fail = true;
    api.on('GET', '/api/team', (route) => {
      if (!fail || !new URL(route.request().url()).searchParams.has('after')) {
        return api.fallback(route);
      }
      fail = false;
      // The connection drops; a 500 would go to the system error page instead.
      return route.abort('failed');
    });
    await team.showMore.click();
    await expect(team.moreFailed).toBeVisible();
    await expect(team.members).toHaveCount(50);
    // Axe reads the list where it was left, with a row half under the sticky top bar.
    await team.scrollUnderTopBar('Member 020');
    await axe.check();

    await team.showMore.click();
    await expect(team.members).toHaveCount(70);
    await expect(team.count).toHaveText('Showing 70 of 70 members');
    await expect(team.showMore).toHaveCount(0);

    await team.roleFilter('Volunteers').click();
    await expect(team.count).toHaveText('Showing 35 of 35 members');
    await expect(team.showMore).toHaveCount(0);
  });
});
