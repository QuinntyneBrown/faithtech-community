import { expect, test } from '../../../e2e/fixtures/app';
import { photoUrl } from '../../../e2e/fixtures/mock-api';
import { PeoplePage } from '../../../e2e/pages/people.page';
import { RoleDialog } from '../../../e2e/pages/role.dialog';
import { Presenter, typeInto } from '../presenter';

// Journey: the people directory (docs/detailed-designs/profiles/people-directory, L2-009, L2-053).
test('people-directory', async ({ page, api }) => {
  const show = await Presenter.start(page, 'people-directory');
  const people = new PeoplePage(page);
  const grace = api.addAccount({
    email: 'grace@example.org',
    name: 'Grace Okonkwo',
    roles: ['CityLead'],
  });
  const marcus = api.addAccount({
    email: 'marcus@example.org',
    name: 'Marcus Lee',
    roles: ['EventLead'],
  });
  const profile = api.profiles.get(marcus.profileId)!;
  profile.homeCity = 'Toronto';
  profile.photos.push({
    id: 'photo-1',
    url: photoUrl('#0b7285'),
    altText: 'Marcus at Builders Night',
    isFeatured: true,
    uploadedAt: '2026-10-01T09:00:00Z',
  });
  api.addAccount({ email: 'leah@example.org', name: 'Leah Thompson' });
  api.addAccount({ email: 'daniel@example.org', name: 'Daniel Reyes', roles: ['Staff'] });

  await show.card(
    'opening',
    'opening',
    ['Find people and manage roles', 'Recorded against a local fake API · synthetic people'],
    () => api.signInAs(grace, '/people'),
  );

  await show.step(
    'directory',
    async () => {
      await expect(people.heading).toHaveText('People and roles');
      await expect.poll(() => people.names()).toHaveLength(4);
      await expect(people.row('Marcus Lee')).toContainText('Event Lead');
      await expect(people.row('Marcus Lee')).toContainText('Toronto');
      await expect(people.row('Leah Thompson')).toContainText('No role yet');
    },
    { poster: true },
  );

  await show.step('protected-roles', async () => {
    await expect(people.row('Daniel Reyes')).toContainText('Only System Admin can change');
    await expect(people.removeRole('Daniel Reyes')).toHaveCount(0);
  });

  await show.step('search', async () => {
    await typeInto(people.search, 'marcus@');
    await people.search.press('Enter');
    await expect.poll(() => people.names()).toEqual(['Marcus Lee']);
    await typeInto(people.search, 'xavier');
    await people.search.press('Enter');
    await expect(people.noResults('xavier')).toBeVisible();
  });

  await show.step('add-role', async () => {
    await people.search.clear();
    await people.search.press('Enter');
    await expect(people.row('Leah Thompson')).toBeVisible();
    await people.addRole('Leah Thompson').click();
    const dialog = new RoleDialog(page, 'Add a role for Leah Thompson');
    await expect(dialog.option('Staff')).toHaveCount(0);
    await dialog.option('Volunteer').check();
    await dialog.confirm.click();
    await expect(dialog.dialog).toBeHidden();
    await expect(people.row('Leah Thompson')).toContainText('Volunteer');
  });

  await show.step('remove-role', async () => {
    await people.removeRole('Marcus Lee').click();
    const dialog = new RoleDialog(page, 'Remove Event Lead from Marcus Lee?');
    await expect(dialog.confirm).toBeVisible();
    await dialog.confirm.click();
    await expect(dialog.dialog).toBeHidden();
    await expect(people.row('Marcus Lee')).toContainText('No role yet');
  });

  await show.card('closing', 'closing', [
    'Search by name or email',
    'City Leads add and remove everyday roles',
    'Protected roles stay with System Admin',
  ]);
  await show.finish();
});
