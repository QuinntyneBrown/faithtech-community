// Traces to: L2-136 AC4, AC5; L2-137 AC1, AC2, AC3; L2-152 AC1
// (docs/detailed-designs/organisations/role-definitions-and-grant-rules)
import { expect, test } from '../../fixtures/app';
import { ArchiveRoleDialog } from '../../pages/archive-role.dialog';
import { EditGrantsDialog } from '../../pages/edit-grants.dialog';
import { OrganisationRolesPage } from '../../pages/organisation-roles.page';

test.describe('Organisation settings: who may grant and archive', () => {
  test('a roles manager changes who a role may grant, administration staying out of reach', async ({
    page,
    api,
    axe,
  }) => {
    api.defineRole({ key: 'Steward', name: 'Steward', capabilities: ['ManageRoles'] });
    const ruth = api.addAccount({ email: 'ruth@example.org', roles: ['Steward'] });
    const roles = new OrganisationRolesPage(page);
    await api.signInAs(ruth, '/organisation/roles');

    await roles.whoMayGrant('City Lead').click();
    const grants = new EditGrantsDialog(page, 'City Lead');
    await expect(grants.role('Event Lead')).toBeChecked();
    await expect(grants.role('Staff')).not.toBeChecked();
    await expect(grants.role('System Admin')).toBeDisabled();
    await expect(grants.dialog).toContainText('Only administrators can grant administration');
    await expect(grants.inactive).toHaveCount(0);
    await axe.check();

    await grants.role('Staff').check();
    await grants.save.click();
    await expect(grants.dialog).toBeHidden();
    await expect(roles.grantsSavedToast).toContainText(
      'City Lead holders can add and remove 7 roles.',
    );
    await roles.whoMayGrant('City Lead').click();
    await expect(new EditGrantsDialog(page, 'City Lead').role('Staff')).toBeChecked();
  });

  test('rules for a role without Assign roles are saved but flagged inactive', async ({
    page,
    api,
  }) => {
    api.defineRole({ key: 'Steward', name: 'Steward', capabilities: ['ManageRoles'] });
    const ruth = api.addAccount({ email: 'ruth@example.org', roles: ['Steward'] });
    const roles = new OrganisationRolesPage(page);
    await api.signInAs(ruth, '/organisation/roles');

    await roles.whoMayGrant('Staff').click();
    const grants = new EditGrantsDialog(page, 'Staff');
    await expect(grants.inactive).toBeVisible();
    await grants.role('Volunteer').check();
    await grants.save.click();
    await expect(roles.grantsSavedToast).toContainText('Staff holders can add and remove 1 role.');
  });

  test('a roles manager archives an unused role, which moves to Archived', async ({
    page,
    api,
    axe,
  }) => {
    api.defineRole({ key: 'Steward', name: 'Steward', capabilities: ['ManageRoles'] });
    api.defineRole({ key: 'Mentor', name: 'Mentor' });
    const ruth = api.addAccount({ email: 'ruth@example.org', roles: ['Steward'] });
    const roles = new OrganisationRolesPage(page);
    await api.signInAs(ruth, '/organisation/roles');

    await roles.archive('Mentor').click();
    const archive = new ArchiveRoleDialog(page, 'Mentor');
    await expect(archive.dialog).toContainText('No one holds Mentor and nothing uses it.');
    await axe.check();
    await archive.confirm.click();
    await expect(archive.dialog).toBeHidden();
    await expect(roles.archivedToast('Mentor')).toContainText(
      'It’s listed under Archived, read-only.',
    );
    await expect(roles.row('Mentor')).toHaveCount(0);
    await roles.archived.click();
    await expect(roles.archivedList).toContainText('Mentor');
  });

  test('archive is refused while members hold the role or a grant rule names it', async ({
    page,
    api,
  }) => {
    api.addAccount({ email: 'v1@example.org', name: 'Ama Volunteer', roles: ['Volunteer'] });
    api.addAccount({ email: 'v2@example.org', name: 'Ben Volunteer', roles: ['Volunteer'] });
    api.defineRole({ key: 'Steward', name: 'Steward', capabilities: ['ManageRoles'] });
    const ruth = api.addAccount({ email: 'ruth@example.org', roles: ['Steward'] });
    const roles = new OrganisationRolesPage(page);
    await api.signInAs(ruth, '/organisation/roles');

    await roles.archive('Volunteer').click();
    let archive = new ArchiveRoleDialog(page, 'Volunteer');
    await archive.confirm.click();
    await expect(archive.refusal).toContainText('Can’t archive Volunteer');
    await expect(archive.refusal).toContainText(
      /\d+ members hold this role\. Remove it from them first\./,
    );
    await expect(archive.buttons).toHaveText(['Close']);
    await archive.close.click();

    await roles.archive('Create Lead').click();
    archive = new ArchiveRoleDialog(page, 'Create Lead');
    await archive.confirm.click();
    await expect(archive.refusal).toContainText(
      'City Lead’s grant rules still use this role. Remove it from them first.',
    );
  });

  test('a holder of only Manage organisation settings sees neither action', async ({
    page,
    api,
  }) => {
    const leah = api.addAccount({
      email: 'leah@example.org',
      capabilities: ['ManageOrganisationSettings'],
    });
    const roles = new OrganisationRolesPage(page);
    await api.signInAs(leah, '/organisation/roles');

    await expect(roles.list).toBeVisible();
    await expect(roles.whoMayGrant('City Lead')).toHaveCount(0);
    await expect(roles.archive('City Lead')).toHaveCount(0);
  });
});
