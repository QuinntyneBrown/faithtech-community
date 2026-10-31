// Traces to: L2-143, L2-141 AC3, L2-138 AC6, L2-136 AC1 (docs/detailed-designs/organisations/chapters)
import { expect, test } from '../../fixtures/app';
import { MockApi } from '../../fixtures/mock-api';
import { FAITHTECH, NORTHSIDE } from '../../fixtures/mock-host';
import { ConnectPage } from '../../pages/connect.page';
import { DefineRoleDialog } from '../../pages/define-role.dialog';
import { OrganisationRolesPage } from '../../pages/organisation-roles.page';
import { PeoplePage } from '../../pages/people.page';
import { ProfilePage } from '../../pages/profile.page';
import { RoleDialog } from '../../pages/role.dialog';
import { TeamPage } from '../../pages/team.page';

/** Grace is City Lead for the given chapters (untagged when none); Leah has no role; Esther volunteers in two cities. */
function cast(api: MockApi, ...graceChapters: string[]) {
  const toronto = api.chapters.named('Toronto').id;
  const austin = api.chapters.named('Austin').id;
  const grace = api.addAccount({
    email: 'grace@example.org',
    name: 'Grace Okonkwo',
    roles: ['CityLead'],
  });
  if (graceChapters.length)
    api.profiles.get(grace.profileId)!.roleChapters = {
      CityLead: graceChapters.map((c) => api.chapters.named(c).id),
    };
  const leah = api.addAccount({ email: 'leah@example.org', name: 'Leah Thompson' });
  const esther = api.addAccount({
    email: 'esther@example.org',
    name: 'Esther Nakamura',
    roles: ['Volunteer'],
  });
  api.profiles.get(esther.profileId)!.roleChapters = { Volunteer: [toronto, austin] };
  return { grace, leah, esther };
}

test.describe('Chapter-tagged roles and scoped granting', () => {
  // L2-143 AC1: a scoped grantor must tag a scopable role, with one of their own chapters.
  test('a City Lead for Toronto grants a role for Toronto only', async ({ page, api, axe }) => {
    const { grace } = cast(api, 'Toronto');
    const people = new PeoplePage(page);
    await api.signInAs(grace, '/people');

    await people.addRole('Leah Thompson').click();
    const dialog = new RoleDialog(page, 'Add a role for Leah Thompson');
    await dialog.option('Product Engineer').check();
    await expect(dialog.chapter).toHaveCount(0);
    await dialog.option('Volunteer').check();
    await expect(dialog.chapter).toHaveAccessibleName('City');
    expect(await dialog.chapterOptions()).toEqual(['Toronto']);
    await expect(dialog.chapter).toHaveAccessibleDescription(
      'Your City Lead role is for Toronto, so you can grant Volunteer for Toronto only.',
    );
    await axe.check();
    await dialog.confirm.click();

    await expect(dialog.dialog).toBeHidden();
    await expect(people.row('Leah Thompson')).toContainText('Volunteer · Toronto');
  });

  // L2-143 AC5: a grantor for several chapters is offered each of them.
  test('a City Lead for two cities is offered both', async ({ page, api }) => {
    const { grace } = cast(api, 'Toronto', 'Austin');
    const people = new PeoplePage(page);
    await api.signInAs(grace, '/people');

    await people.addRole('Leah Thompson').click();
    const dialog = new RoleDialog(page, 'Add a role for Leah Thompson');
    await dialog.option('Event Lead').check();
    expect(await dialog.chapterOptions()).toEqual(['Toronto', 'Austin']);
  });

  // L2-143 AC3, L2-141 AC3: an untagged grantor tags any chapter or none, and the badge names it.
  test('an untagged City Lead may tag any city or none', async ({ page, api, axe }) => {
    const { grace, leah } = cast(api);
    const profile = new ProfilePage(page);
    await api.signInAs(grace, `/people/${leah.profileId}`);

    await profile.addRole.click();
    const dialog = new RoleDialog(page, 'Add a role for Leah Thompson');
    await dialog.option('Volunteer').check();
    await expect(dialog.chapter).toHaveAccessibleName('City (optional)');
    expect((await dialog.chapterOptions()).slice(0, 3)).toEqual(['No city', 'Toronto', 'Austin']);
    await expect(dialog.chapter).toHaveAccessibleDescription(
      'Volunteer can be held for a city. The tag never limits what Leah sees.',
    );
    await dialog.chapter.selectOption('Austin');
    await axe.check();
    await dialog.confirm.click();

    await expect(dialog.dialog).toBeHidden();
    await expect(profile.roles).toHaveText(['Volunteer · Austin']);
  });

  // L2-143 AC2: a scoped grantor is offered only the assignments in their own chapters to remove.
  test('a City Lead for Toronto removes only the Toronto assignment', async ({ page, api }) => {
    const { grace } = cast(api, 'Toronto');
    const people = new PeoplePage(page);
    await api.signInAs(grace, '/people');
    await expect(people.row('Esther Nakamura')).toContainText('Volunteer · Toronto');
    await expect(people.row('Esther Nakamura')).toContainText('Volunteer · Austin');

    await people.removeRole('Esther Nakamura').click();
    const dialog = new RoleDialog(page, 'Remove Volunteer · Toronto from Esther Nakamura?');
    await dialog.confirm.click();

    await expect(dialog.dialog).toBeHidden();
    await expect(people.row('Esther Nakamura')).not.toContainText('Toronto');
    await expect(people.row('Esther Nakamura')).toContainText('Volunteer · Austin');
  });

  // L2-143 AC4: an administrator removes either assignment, each named by its chapter.
  test('an administrator chooses which tagged assignment to remove', async ({ page, api, axe }) => {
    cast(api);
    const admin = api.addAccount({ email: 'priya@example.org', roles: ['SystemAdmin'] });
    const people = new PeoplePage(page);
    await api.signInAs(admin, '/people');

    await people.removeRole('Esther Nakamura').click();
    const dialog = new RoleDialog(page, /^Remove .* from Esther Nakamura\?$/);
    await expect(dialog.option('Volunteer · Toronto')).toBeVisible();
    await dialog.option('Volunteer · Austin').check();
    await axe.check();
    await dialog.confirm.click();

    await expect(dialog.dialog).toBeHidden();
    await expect(people.row('Esther Nakamura')).not.toContainText('Austin');
  });

  // L2-141 AC3: the team list reads "{role} · {chapter}".
  test('the team list names the chapter of each tagged role', async ({ page, api, axe }) => {
    const { grace } = cast(api);
    const team = new TeamPage(page);
    await api.signInAs(grace, '/team');

    await expect(team.member('Esther Nakamura')).toContainText('Volunteer · Toronto');
    await expect(team.member('Esther Nakamura')).toContainText('Volunteer · Austin');
    await axe.check();
  });

  // L2-141 AC3: the connect page names the chapter the lead's link role is held for.
  test('the connect page reads the lead role with its city', async ({ page, api, axe }) => {
    const { grace } = cast(api, 'Austin');
    const link = api.connect.addLink(grace.profileId);
    const connect = new ConnectPage(page);

    await connect.open(link.token);

    await expect(connect.leadMeta).toHaveText('City Lead · Austin');
    await axe.check();
  });

  // L2-143 AC6: with chapters off a tagged grantor grants without a chapter.
  test('with chapters off a City Lead for Toronto grants with no chapter', async ({
    page,
    api,
  }) => {
    api.host.serve({ ...FAITHTECH, chapterLabel: null });
    const { grace } = cast(api, 'Toronto');
    const people = new PeoplePage(page);
    await api.signInAs(grace, '/people');

    await people.addRole('Leah Thompson').click();
    const dialog = new RoleDialog(page, 'Add a role for Leah Thompson');
    await dialog.option('Volunteer').check();
    await expect(dialog.chapter).toHaveCount(0);
    await dialog.confirm.click();

    await expect(dialog.dialog).toBeHidden();
    await expect(people.row('Leah Thompson')).toContainText('Volunteer');
    await expect(people.row('Esther Nakamura')).not.toContainText('·');
  });

  // L2-136 AC1: "Can be held for a {chapter}" is saved with the role, and hidden while chapters are off.
  test('a role is defined as one that can be held for a city', async ({ page, api, axe }) => {
    const admin = api.addAccount({ email: 'priya@example.org', roles: ['SystemAdmin'] });
    const roles = new OrganisationRolesPage(page);
    await api.signInAs(admin, '/organisation/roles');

    await roles.defineRole.click();
    const dialog = new DefineRoleDialog(page, 'Define a role');
    await dialog.name.fill('Meet-up Lead');
    await dialog.capability('Manage events').check();
    await dialog.chapterScopable.click();
    await axe.check();
    await dialog.save.click();

    await expect(dialog.dialog).toBeHidden();
    expect(api.definitionNamed('Meet-up Lead')?.chapterScopable).toBe(true);
  });

  test('with chapters off the define-role dialog has no chapter switch', async ({ page, api }) => {
    api.host.serve(NORTHSIDE);
    const admin = api.addAccount({ email: 'priya@example.org', roles: ['SystemAdmin'] });
    const roles = new OrganisationRolesPage(page);
    await api.signInAs(admin, '/organisation/roles');

    await roles.defineRole.click();
    const dialog = new DefineRoleDialog(page, 'Define a role');
    await expect(dialog.showOnTeam).toBeVisible();
    await expect(dialog.chapterScopable).toHaveCount(0);
  });
});
