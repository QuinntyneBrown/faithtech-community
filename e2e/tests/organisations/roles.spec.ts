// Traces to: L2-136 AC1, AC2, AC3, AC5, AC6, AC7, AC8; L2-147 AC2; L2-152 AC1
// (docs/detailed-designs/organisations/role-definitions-and-grant-rules)
import { expect, test } from '../../fixtures/app';
import { DefineRoleDialog } from '../../pages/define-role.dialog';
import { OrganisationRolesPage } from '../../pages/organisation-roles.page';

test.describe('Organisation settings: Roles', () => {
  test('a roles manager sees every role in order with its holders, capabilities and flags', async ({
    page,
    api,
    axe,
  }) => {
    api.addAccount({ email: 'v1@example.org', name: 'Ama Volunteer', roles: ['Volunteer'] });
    api.addAccount({ email: 'v2@example.org', name: 'Ben Volunteer', roles: ['Volunteer'] });
    api.defineRole({ key: 'Steward', name: 'Steward', capabilities: ['ManageRoles'] });
    const ruth = api.addAccount({ email: 'ruth@example.org', roles: ['Steward'] });
    const roles = new OrganisationRolesPage(page);
    await api.signInAs(ruth, '/organisation');

    await roles.rolesTab.click();
    await expect(page).toHaveURL(/\/organisation\/roles$/);
    await expect(roles.tabs).toHaveText(['General', 'Roles']);
    await expect
      .poll(() => roles.names())
      .toEqual([
        'City Lead',
        'Event Lead',
        'Create Lead',
        'Communications Lead',
        'Staff',
        'Volunteer',
        'Product Engineer',
        'Attendee',
        'System Admin',
        'Steward',
      ]);
    await expect(roles.row('Volunteer')).toContainText('2 members');
    await expect(roles.row('Volunteer')).toContainText('Team list');
    await expect(roles.row('City Lead')).toContainText(
      /Manage events, View attendees and \d+ more/,
    );
    await expect(roles.row('System Admin')).toContainText('Administer the organisation');
    await axe.check();
  });

  test('a roles manager defines a role, which joins the list', async ({ page, api, axe }) => {
    api.defineRole({ key: 'Steward', name: 'Steward', capabilities: ['ManageRoles'] });
    const ruth = api.addAccount({ email: 'ruth@example.org', roles: ['Steward'] });
    const roles = new OrganisationRolesPage(page);
    await api.signInAs(ruth, '/organisation/roles');

    await roles.defineRole.click();
    const dialog = new DefineRoleDialog(page, 'Define a role');
    await expect(dialog.name).toBeFocused();
    await dialog.save.click();
    await expect(dialog.error('Enter a name for the role.')).toBeVisible();
    await dialog.name.fill('volunteer');
    await dialog.save.click();
    await expect(
      dialog.error('A role called volunteer already exists. Choose another name.'),
    ).toBeVisible();
    await axe.check();

    await dialog.name.fill('Meet-up Lead');
    await dialog.description.fill('Runs monthly meet-ups in their city.');
    await dialog.capability('Manage events').check();
    await dialog.capability('View attendees').check();
    await dialog.showOnTeam.click();
    await dialog.save.click();

    await expect(dialog.dialog).toBeHidden();
    await expect(roles.definedToast).toContainText('Meet-up Lead is ready.');
    await expect(roles.row('Meet-up Lead')).toContainText(
      'Runs monthly meet-ups in their city. · 0 members',
    );
    await expect(roles.row('Meet-up Lead')).toContainText('Manage events, View attendees');
    await expect(roles.row('Meet-up Lead')).toContainText('Team list');
    expect(api.audit.at(-1)).toMatchObject({ action: 'role.defined' });
  });

  test('an edit applies to every holder on their next request', async ({ page, api }) => {
    api.defineRole({ key: 'Steward', name: 'Steward', capabilities: ['ManageRoles'] });
    const ruth = api.addAccount({ email: 'ruth@example.org', roles: ['Steward'] });
    const roles = new OrganisationRolesPage(page);
    await api.signInAs(ruth, '/organisation/roles');

    await roles.edit('Steward').click();
    const dialog = new DefineRoleDialog(page, 'Edit Steward');
    await expect(dialog.dialog).toContainText(
      '1 member holds Steward. Changes apply on their next request.',
    );
    await expect(dialog.name).toHaveValue('Steward');
    await expect(dialog.capability('Manage roles')).toBeChecked();
    await dialog.capability('View reports').check();
    await dialog.save.click();

    await expect(dialog.dialog).toBeHidden();
    await expect(roles.savedToast).toBeVisible();
    await expect(roles.row('Steward')).toContainText('View reports, Manage roles');
    expect(api.capabilitiesOf(ruth)).toEqual(['ViewReports', 'ManageRoles']);
    expect(api.audit.at(-1)).toMatchObject({ action: 'role.updated' });
  });

  test('only an administrator can add Administer the organisation', async ({ page, api, axe }) => {
    api.defineRole({ key: 'Steward', name: 'Steward', capabilities: ['ManageRoles'] });
    const ruth = api.addAccount({ email: 'ruth@example.org', roles: ['Steward'] });
    const roles = new OrganisationRolesPage(page);
    await api.signInAs(ruth, '/organisation/roles');

    await roles.defineRole.click();
    const dialog = new DefineRoleDialog(page, 'Define a role');
    await dialog.name.fill('Trustee');
    await dialog.capability('Administer the organisation').check();
    await dialog.save.click();

    await expect(dialog.refusal).toContainText('Only an administrator can grant administration.');
    await expect(dialog.name).toHaveValue('Trustee');
    await axe.check();
  });

  test('the last administrators’ role keeps Administer the organisation', async ({ page, api }) => {
    const priya = api.addAccount({ email: 'priya@example.org', roles: ['SystemAdmin'] });
    const roles = new OrganisationRolesPage(page);
    await api.signInAs(priya, '/organisation/roles');

    await roles.edit('System Admin').click();
    const dialog = new DefineRoleDialog(page, 'Edit System Admin');
    await dialog.capability('Administer the organisation').uncheck();
    await dialog.save.click();

    await expect(dialog.refusal).toContainText('There must always be at least one administrator.');
    expect(api.capabilitiesOf(priya)).toContain('AdministerOrganisation');
  });

  test('the archived filter shows archived roles read-only', async ({ page, api, axe }) => {
    api.defineRole({ key: 'Steward', name: 'Steward', capabilities: ['ManageRoles'] });
    api.defineRole({
      key: 'Judge',
      name: 'Hackathon Judge',
      capabilities: ['ViewAttendees'],
      archived: true,
    });
    const ruth = api.addAccount({ email: 'ruth@example.org', roles: ['Steward'] });
    const roles = new OrganisationRolesPage(page);
    await api.signInAs(ruth, '/organisation/roles');

    await expect(roles.row('Hackathon Judge')).toHaveCount(0);
    await roles.archived.click();
    await expect(roles.archivedList).toBeVisible();
    await expect(roles.row('Hackathon Judge')).toBeVisible();
    await expect(roles.edit('Hackathon Judge')).toHaveCount(0);
    await axe.check();
  });

  test('a settings manager reads the roles but cannot change them', async ({ page, api, axe }) => {
    const grace = api.addAccount({
      email: 'grace@example.org',
      roles: ['Coordinator'],
      capabilities: ['ManageOrganisationSettings'],
    });
    const roles = new OrganisationRolesPage(page);
    await api.signInAs(grace, '/organisation/roles');

    await expect(roles.row('City Lead')).toBeVisible();
    await expect(roles.readOnly).toBeVisible();
    await expect(roles.defineRole).toHaveCount(0);
    await expect(roles.edit('City Lead')).toHaveCount(0);
    await axe.check();
  });
});
