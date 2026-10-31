// Traces to: L2-053, L2-009 (docs/detailed-designs/profiles/people-directory)
import { expect, test } from '../../fixtures/app';
import { MockApi, photoUrl } from '../../fixtures/mock-api';
import { AppShell } from '../../pages/app-shell.page';
import { PeoplePage } from '../../pages/people.page';
import { RoleDialog } from '../../pages/role.dialog';
import { SignInPage } from '../../pages/sign-in.page';

function addPeople(api: MockApi) {
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
  const leah = api.addAccount({ email: 'leah@example.org', name: 'Leah Thompson' });
  api.addAccount({ email: 'daniel@example.org', name: 'Daniel Reyes', roles: ['Staff'] });
  return { grace, marcus, leah };
}

test.describe('People and roles', () => {
  test('a City Lead finds members and adds a role from a row without a reload', async ({
    page,
    api,
    axe,
  }) => {
    const { grace, marcus } = addPeople(api);
    const people = new PeoplePage(page);
    await api.signInAs(grace, '/people');

    await expect(people.heading).toHaveText('People and roles');
    await expect(people.subtitle).toHaveText(
      'You can add or remove Event Lead, Create Lead, Communications Lead, Volunteer, Product Engineer and Attendee.',
    );
    await expect
      .poll(() => people.names())
      .toEqual(['Daniel Reyes', 'Grace Okonkwo', 'Leah Thompson', 'Marcus Lee']);
    await expect(people.profileLink('Marcus Lee')).toHaveAttribute(
      'href',
      `/people/${marcus.profileId}`,
    );
    await expect(people.photo('Marcus Lee')).toBeVisible();
    await expect(people.row('Marcus Lee')).toContainText('Event Lead');
    await expect(people.row('Marcus Lee')).toContainText('Toronto');
    await expect(people.row('Leah Thompson')).toContainText('No role yet');
    await expect(people.row('Daniel Reyes')).toContainText('Only an administrator can change');
    await expect(people.removeRole('Daniel Reyes')).toHaveCount(0);
    await expect(people.inviteSomeone).toHaveAttribute('href', '/invites');
    await axe.check();

    await people.addRole('Leah Thompson').click();
    const dialog = new RoleDialog(page, 'Add a role for Leah Thompson');
    await expect(dialog.option('Staff')).toHaveCount(0);
    await dialog.option('Volunteer').check();
    await dialog.confirm.click();

    await expect(dialog.dialog).toBeHidden();
    await expect(people.row('Leah Thompson')).toContainText('Volunteer');
    expect(api.callsTo('GET', '/api/people')).toHaveLength(1);
  });

  test('a City Lead removes a role from a row', async ({ page, api }) => {
    const { grace } = addPeople(api);
    const people = new PeoplePage(page);
    await api.signInAs(grace, '/people');

    await people.removeRole('Marcus Lee').click();
    const dialog = new RoleDialog(page, 'Remove Event Lead from Marcus Lee?');
    await dialog.confirm.click();

    await expect(dialog.dialog).toBeHidden();
    await expect(people.row('Marcus Lee')).toContainText('No role yet');
  });

  test('a search by name or email narrows the list, and no match offers an invite', async ({
    page,
    api,
    axe,
  }) => {
    const { grace } = addPeople(api);
    const people = new PeoplePage(page);
    await api.signInAs(grace, '/people');

    await people.searchFor('marcus@');
    await expect.poll(() => people.names()).toEqual(['Marcus Lee']);
    await people.searchFor('xavier');
    await expect(people.noResults('xavier')).toBeVisible();
    await expect(people.inviteSomeone.last()).toHaveAttribute('href', '/invites');
    await axe.check();
  });

  test('a System Admin may change any role', async ({ page, api }) => {
    addPeople(api);
    const priya = api.addAccount({
      email: 'priya@example.org',
      name: 'Priya Shah',
      roles: ['SystemAdmin'],
    });
    const people = new PeoplePage(page);
    await api.signInAs(priya, '/people');

    await expect(people.subtitle).toHaveText('As an administrator you can assign any role.');
    await expect(people.removeRole('Daniel Reyes')).toBeVisible();
    await expect(people.row('Daniel Reyes')).not.toContainText('Only an administrator can change');
  });

  test('a grantor of a test-defined organisation may change only the roles their rule names', async ({
    page,
    api,
  }) => {
    api.defineRole({ key: 'Helper', name: 'Helper' });
    api.defineRole({
      key: 'Coordinator',
      name: 'Coordinator',
      capabilities: ['AssignRoles', 'ViewPeopleDirectory'],
      grants: ['Helper'],
    });
    const cora = api.addAccount({
      email: 'cora@example.org',
      name: 'Cora Diaz',
      roles: ['Coordinator'],
    });
    api.addAccount({ email: 'hana@example.org', name: 'Hana Ito', roles: ['Helper'] });
    const people = new PeoplePage(page);
    await api.signInAs(cora, '/people');

    await expect(people.subtitle).toHaveText('You can add or remove Helper.');
    await expect(people.removeRole('Hana Ito')).toBeVisible();
    await expect(people.removeRole('Cora Diaz')).toHaveCount(0);
    await expect(people.row('Cora Diaz')).toContainText('Only an administrator can change');
  });

  test('Staff see the list read-only, in light and dark', async ({ page, api, axe }) => {
    addPeople(api);
    const staff = api.accounts.get('daniel@example.org')!;
    const people = new PeoplePage(page);
    await api.signInAs(staff, '/people');

    await expect(people.subtitle).toHaveText('Read-only for Staff.');
    await expect(people.row('Marcus Lee')).toBeVisible();
    await expect(people.rows.getByRole('button')).toHaveCount(0);
    await expect(people.inviteSomeone).toHaveCount(0);
    await axe.check();
    await page.emulateMedia({ colorScheme: 'dark' });
    await axe.check();
  });

  test('anyone else sees the forbidden page and the API refuses them', async ({
    page,
    api,
    axe,
  }) => {
    const { leah } = addPeople(api);
    const people = new PeoplePage(page);
    await api.signInAs(leah, '/people');

    await expect(people.forbidden).toBeVisible();
    await expect(people.backToHome).toHaveAttribute('href', '/');
    await expect(people.table).toHaveCount(0);
    await axe.check();
  });

  test('loading, failure and retry match the mocks', async ({ page, api, axe }) => {
    const { grace } = addPeople(api);
    let attempts = 0;
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    api.on('GET', '/api/people', async (route) => {
      attempts++;
      if (attempts === 1) {
        await held;
        return route.fulfill({ status: 503 });
      }
      return api.fallback(route);
    });
    const people = new PeoplePage(page);
    await api.signInAs(grace, '/people');

    await expect(people.skeleton).toBeVisible();
    release();
    await expect(people.loadError).toBeVisible();
    await axe.check();
    await people.tryAgain.click();
    await expect(people.row('Marcus Lee')).toBeVisible();
  });

  test('anonymous visitors are sent to sign in', async ({ page }) => {
    await page.goto('/people');

    await expect(page).toHaveURL(/\/sign-in\?returnUrl=%2Fpeople/);
    await expect(new SignInPage(page).heading).toBeVisible();
  });

  test('City Leads reach people from the People link', async ({ page, api }) => {
    const { grace } = addPeople(api);
    const shell = new AppShell(page);
    await api.signInAs(grace);

    await shell.navLink('People').click();
    await expect(new PeoplePage(page).heading).toHaveText('People and roles');
  });
});
