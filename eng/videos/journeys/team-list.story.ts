import { expect, test } from '../../../e2e/fixtures/app';
import { photoUrl } from '../../../e2e/fixtures/mock-api';
import { TeamPage } from '../../../e2e/pages/team.page';
import { Presenter } from '../presenter';

// Journey: the team list (docs/detailed-designs/team/team-list, L2-019).
test('team-list', async ({ page, api }) => {
  const show = await Presenter.start(page, 'team-list');
  const team = new TeamPage(page);
  const grace = api.addAccount({
    email: 'grace@example.org',
    name: 'Grace Okonkwo',
    roles: ['CityLead'],
  });
  const profile = api.profiles.get(grace.profileId)!;
  profile.homeCity = 'Toronto';
  profile.photos.push({
    id: 'photo-1',
    url: photoUrl('#0b7285'),
    altText: 'Grace speaking at Builders Night',
    isFeatured: true,
    uploadedAt: '2026-10-01T09:00:00Z',
  });
  api.addProfile({ name: 'Marcus Lee', homeCity: 'Austin', roles: ['EventLead'] });
  api.addProfile({
    name: 'Samuel Mensah',
    homeCity: 'Toronto',
    roles: ['CreateLead', 'ProductEngineer'],
  });
  api.addProfile({ name: 'Ruth Alvarez', homeCity: 'Toronto', roles: ['Volunteer'] });
  api.addProfile({ name: 'Nate Oyelaran', homeCity: 'Vancouver', roles: ['ProductEngineer'] });

  await show.card(
    'opening',
    'opening',
    ['Meet the team', 'Recorded against a local fake API · synthetic people'],
    () => api.signInAs(grace, '/team'),
  );

  await show.step(
    'everyone',
    async () => {
      await expect(team.heading).toHaveText('Team');
      await expect
        .poll(() => team.names())
        .toEqual(['Grace Okonkwo', 'Marcus Lee', 'Ruth Alvarez', 'Samuel Mensah']);
      await expect(team.photo('Grace Okonkwo')).toBeVisible();
      await expect(team.member('Samuel Mensah')).toContainText('Product Engineer');
    },
    { poster: true },
  );

  await show.step('leads', async () => {
    await team.roleFilter('Leads').click();
    await expect(team.roleFilter('Leads')).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => team.names()).toEqual(['Grace Okonkwo', 'Marcus Lee', 'Samuel Mensah']);
  });

  await show.step('city', async () => {
    await team.city.selectOption('Toronto');
    await expect.poll(() => team.names()).toEqual(['Grace Okonkwo', 'Samuel Mensah']);
  });

  await show.step('no-match', async () => {
    await team.roleFilter('Volunteers').click();
    await team.city.selectOption('Austin');
    await expect(team.noResults('No volunteers in Austin yet')).toBeVisible();
  });

  await show.step('show-everyone', async () => {
    await team.showEveryone.click();
    await expect(team.roleFilter('All')).toHaveAttribute('aria-pressed', 'true');
    await expect(team.members).toHaveCount(4);
  });

  await show.step('open-profile', async () => {
    await expect(team.inviteSomeone).toHaveAttribute('href', '/invites');
    await team.profileLink('Ruth Alvarez').click();
    await expect(page).toHaveURL(/\/people\/profile-\d+$/);
  });

  await show.card('closing', 'closing', [
    'Every lead and volunteer in one place',
    'Filter by role and by city',
    'Each card opens a profile',
  ]);
  await show.finish();
});
