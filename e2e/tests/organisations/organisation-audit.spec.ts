// Traces to: L2-152 AC2, AC3; L2-041 AC2, AC4 (docs/detailed-designs/organisations/organisation-settings)
import { readFile } from 'node:fs/promises';

import { expect, test } from '../../fixtures/app';
import { MockApi } from '../../fixtures/mock-api';
import { AuditLogPage } from '../../pages/audit-log.page';
import { OrganisationGeneralPage } from '../../pages/organisation-general.page';

// One entry per settings category, a role change and a suspension only an administrator reads.
function settingsHistory(api: MockApi): void {
  api.addAuditEntry({
    action: 'organisation.updated',
    targetType: 'Organisation',
    summary: 'Changed the short name from FaithTech Community to FaithTech',
    occurredAtUtc: '2026-10-21T10:40:00Z',
  });
  api.addAuditEntry({
    action: 'chapter.updated',
    targetType: 'Chapter',
    summary: 'Renamed Toronto to Toronto East',
    occurredAtUtc: '2026-10-21T10:58:00Z',
  });
  api.addAuditEntry({
    action: 'taxonomy.updated',
    targetType: 'PartnerStage',
    summary: 'Set In Funnel as the initial partner stage',
    occurredAtUtc: '2026-10-21T10:51:00Z',
  });
  api.addAuditEntry({
    action: 'role.defined',
    targetType: 'RoleDefinition',
    summary: 'Defined the role Meet-up Lead',
    occurredAtUtc: '2026-10-21T11:42:00Z',
  });
  api.addAuditEntry({
    action: 'user.suspended',
    summary: 'Suspended Victor Kane — reason: Spam',
    occurredAtUtc: '2026-10-21T09:00:00Z',
  });
}

test.describe('Organisation audit', () => {
  test('an administrator filters the settings categories', async ({ page, api, axe }) => {
    settingsHistory(api);
    const priya = api.addAccount({ email: 'priya@example.org', roles: ['SystemAdmin'] });
    const audit = new AuditLogPage(page);
    await api.signInAs(priya, '/admin/audit-log');

    await expect(audit.categoryOptions).toHaveText([
      'All actions',
      'Roles',
      'Suspensions',
      'Private contact access',
      'Deletions',
      'Organisation',
      'Cities',
      'Stages & types',
    ]);
    await expect(audit.rows).toHaveCount(5);

    await audit.category.selectOption({ label: 'Stages & types' });
    await expect(audit.rows).toHaveCount(1);
    await expect(audit.rows.first()).toContainText('Set In Funnel as the initial partner stage');
    await audit.category.selectOption({ label: 'Cities' });
    await expect(audit.rows).toHaveText([/Renamed Toronto to Toronto East/]);
    await axe.check();
  });

  test('a settings manager reaches their part of the audit log from General', async ({
    page,
    api,
    axe,
  }) => {
    settingsHistory(api);
    const grace = api.addAccount({
      email: 'grace@example.org',
      name: 'Grace Okonkwo',
      roles: ['Coordinator'],
      capabilities: ['ManageOrganisationSettings'],
    });
    const general = new OrganisationGeneralPage(page);
    const audit = new AuditLogPage(page);
    await api.signInAs(grace, '/organisation');

    await general.viewAuditLog.click();
    await expect(page).toHaveURL(/\/organisation\/audit$/);
    await expect(audit.heading).toHaveText('Audit log');
    await expect(audit.subtitle).toHaveText(
      'You can see the settings you can change: Organisation, Cities and Stages & types.',
    );
    await expect(audit.breadcrumb).toContainText('Organisation');
    await expect(audit.adminTabs).toHaveCount(0);
    await expect(audit.categoryOptions).toHaveText([
      'Everything you can see',
      'Organisation',
      'Cities',
      'Stages & types',
    ]);
    await expect(audit.rows).toHaveText([
      /Renamed Toronto to Toronto East/,
      /Set In Funnel as the initial partner stage/,
      /Changed the short name from FaithTech Community to FaithTech/,
    ]);
    await axe.check();

    const download = page.waitForEvent('download');
    await audit.exportCsv.click();
    const csv = await readFile((await (await download).path())!, 'utf8');
    expect(csv).toContain('Renamed Toronto to Toronto East');
    expect(csv).not.toContain('Defined the role Meet-up Lead');
    expect(csv).not.toContain('Suspended Victor Kane');
  });

  test('a roles manager reads only the roles category', async ({ page, api, axe }) => {
    settingsHistory(api);
    const ruth = api.addAccount({
      email: 'ruth@example.org',
      roles: ['Coordinator'],
      capabilities: ['ManageRoles'],
    });
    const audit = new AuditLogPage(page);
    await api.signInAs(ruth, '/organisation/audit');

    await expect(audit.subtitle).toHaveText('You can see the settings you can change: Roles.');
    await expect(audit.categoryOptions).toHaveText(['Everything you can see', 'Roles']);
    await expect(audit.rows).toHaveText([/Defined the role Meet-up Lead/]);
    await axe.check();
  });
});
