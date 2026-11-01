import { expect, test } from '../../../e2e/fixtures/app';
import { EditGeneralSettingsDialog } from '../../../e2e/pages/edit-general-settings.dialog';
import { OrganisationGeneralPage } from '../../../e2e/pages/organisation-general.page';
import { OrganisationRolesPage } from '../../../e2e/pages/organisation-roles.page';
import { OrganisationTaxonomiesPage } from '../../../e2e/pages/organisation-taxonomies.page';
import { AuditLogPage } from '../../../e2e/pages/audit-log.page';
import { Presenter } from '../presenter';

// Journey: Organisation settings (docs/detailed-designs/organisations/organisation-settings, L2-147, L2-152).
test('organisation-settings', async ({ page, api }) => {
  const show = await Presenter.start(page, 'organisation-settings');
  const general = new OrganisationGeneralPage(page);
  const roles = new OrganisationRolesPage(page);
  const taxonomies = new OrganisationTaxonomiesPage(page);
  const priya = api.addAccount({
    email: 'priya@example.org',
    name: 'Priya Shah',
    roles: ['SystemAdmin'],
  });

  await show.card(
    'opening',
    'opening',
    ['Run your organisation’s settings', 'Recorded against a local fake API · synthetic people'],
    () => api.signInAs(priya, '/organisation'),
  );

  await show.step(
    'general',
    async () => {
      await expect(general.value('Name')).toHaveText('FaithTech Community');
      await expect(general.value('Short name')).toHaveText('FaithTech');
    },
    { poster: true },
  );

  await show.step('rename', async () => {
    await general.edit.click();
    const dialog = new EditGeneralSettingsDialog(page);
    await dialog.name.fill('FaithTech Global');
    await dialog.shortName.fill('FT Global');
    await dialog.save.click();
    await expect(general.savedToast).toBeVisible();
    await expect(general.value('Name')).toHaveText('FaithTech Global');
  });

  await show.step('roles', async () => {
    await roles.rolesTab.click();
    await expect(roles.row('Volunteer')).toBeVisible();
  });

  await show.step('stages', async () => {
    await taxonomies.tab.click();
    await expect.poll(() => taxonomies.stageNames()).toContain('Confirmed');
  });

  await show.step('audit', async () => {
    await general.open();
    await general.viewAuditLog.click();
    await expect(new AuditLogPage(page).rows.first()).toContainText('FaithTech Global');
  });

  await show.card('closing', 'closing', [
    'Name, roles, chapters, stages and types',
    'Every change in the audit log',
    'For those who may change them',
  ]);
  await show.finish();
});
