// Traces to: L2-147 AC1-AC5, L2-152 AC1, L2-134 (docs/detailed-designs/organisations/organisation-settings)
import { expect, test } from '../../fixtures/app';
import { NORTHSIDE } from '../../fixtures/mock-host';
import { AppShell } from '../../pages/app-shell.page';
import { EditGeneralSettingsDialog } from '../../pages/edit-general-settings.dialog';
import { ErrorPages } from '../../pages/error-pages.page';
import { OrganisationGeneralPage } from '../../pages/organisation-general.page';

test.describe('Organisation settings: General', () => {
  test('a settings manager finds Organisation before Admin and renames the organisation', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({
      email: 'grace@example.org',
      roles: ['Coordinator'],
      capabilities: ['ManageOrganisationSettings'],
    });
    const shell = new AppShell(page);
    const general = new OrganisationGeneralPage(page);
    await api.signInAs(grace, '/');

    await expect.poll(() => shell.navLabels()).toContain('Organisation');
    await shell.navLink('Organisation').click();
    await expect(page).toHaveURL(/\/organisation$/);
    await expect(general.heading).toHaveText('FaithTech Community');
    await expect(general.tabs).toHaveText(['General']);
    await expect(general.value('Name')).toHaveText('FaithTech Community');
    await expect(general.value('Short name')).toHaveText('FaithTech');
    await expect(general.value('Chapters')).toHaveText('On, called City / Cities');
    await expect(general.readOnly).toHaveCount(0);
    await axe.check();

    await general.edit.click();
    const dialog = new EditGeneralSettingsDialog(page);
    await expect(dialog.name).toBeFocused();
    await expect(dialog.name).toHaveValue('FaithTech Community');
    await dialog.name.fill('');
    await dialog.shortName.fill(' ');
    await dialog.save.click();
    await expect(dialog.nameError).toBeVisible();
    await expect(dialog.shortNameError).toBeVisible();
    await axe.check();

    await dialog.name.fill('FaithTech Global');
    await dialog.shortName.fill('FT Global');
    await dialog.save.click();

    await expect(dialog.dialog).toBeHidden();
    await expect(general.savedToast).toBeVisible();
    await expect(general.heading).toHaveText('FaithTech Global');
    await expect(general.value('Short name')).toHaveText('FT Global');
    await expect(shell.brand).toContainText('FT Global');
    expect(api.callsTo('PUT', '/api/organisation')[0].body).toEqual({
      name: 'FaithTech Global',
      shortName: 'FT Global',
    });
    expect(api.audit.at(-1)).toMatchObject({ action: 'organisation.updated' });
  });

  test('a failed save keeps the dialog open with the input and offers Try again', async ({
    page,
    api,
  }) => {
    const priya = api.addAccount({ email: 'priya@example.org', roles: ['SystemAdmin'] });
    const general = new OrganisationGeneralPage(page);
    await api.signInAs(priya, '/organisation');

    api.failNextOrganisationUpdate();
    await general.edit.click();
    const dialog = new EditGeneralSettingsDialog(page);
    await dialog.shortName.fill('FT');
    await dialog.save.click();

    await expect(dialog.failed).toBeVisible();
    await expect(dialog.shortName).toHaveValue('FT');
    await expect(dialog.save).toHaveText('Try again');
    await dialog.save.click();
    await expect(dialog.dialog).toBeHidden();
    await expect(general.value('Short name')).toHaveText('FT');
  });

  test('a holder of only ManageRoles reads the settings but cannot change them', async ({
    page,
    api,
    axe,
  }) => {
    api.host.serve(NORTHSIDE);
    const ruth = api.addAccount({
      email: 'ruth@example.org',
      roles: ['Steward'],
      capabilities: ['ManageRoles'],
    });
    const general = new OrganisationGeneralPage(page);
    await api.signInAs(ruth, '/organisation');

    await expect(general.heading).toHaveText('Northside Makers');
    await expect(general.readOnly).toBeVisible();
    await expect(general.edit).toHaveCount(0);
    await expect(general.value('Chapters')).toHaveText('Off');
    await axe.check();
  });

  test('anyone else sees no Organisation section and the forbidden page', async ({ page, api }) => {
    const marcus = api.addAccount({ email: 'marcus@example.org', roles: ['CityLead'] });
    const shell = new AppShell(page);
    await api.signInAs(marcus, '/');

    await expect.poll(() => shell.navLabels()).not.toContain('Organisation');
    await page.goto('/organisation');
    await expect(new ErrorPages(page).forbidden).toBeVisible();
  });
});
