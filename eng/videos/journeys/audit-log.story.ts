import { expect, test } from '../../../e2e/fixtures/app';
import { AuditLogPage } from '../../../e2e/pages/audit-log.page';
import { Presenter } from '../presenter';

// Journey: the audit log (docs/detailed-designs/admin/audit-log, L2-041).
test('audit-log', async ({ page, api }) => {
  const show = await Presenter.start(page, 'audit-log');
  const audit = new AuditLogPage(page);
  const priya = api.addAccount({
    email: 'priya@example.org',
    name: 'Priya Shah',
    roles: ['SystemAdmin'],
  });
  api.addAuditEntry({
    action: 'role.granted',
    summary: 'Granted City Lead to Esther Nakamura',
    occurredAtUtc: '2026-10-21T10:05:00Z',
  });
  api.addAuditEntry({
    action: 'role.granted',
    summary: 'Granted Staff to Daniel Reyes',
    occurredAtUtc: '2026-10-15T14:30:00Z',
  });

  await show.card(
    'opening',
    'opening',
    ['See every admin action', 'Recorded against a local fake API · synthetic people'],
    () => api.signInAs(priya, '/admin/audit-log'),
  );

  await show.step(
    'entries',
    async () => {
      await expect(audit.rows).toHaveCount(2);
      await expect(audit.rows.first()).toContainText('Priya Shah');
      await expect(audit.rows.first()).toContainText('Granted City Lead to Esther Nakamura');
    },
    { poster: true },
  );

  await show.step('export', async () => {
    const download = page.waitForEvent('download');
    await audit.exportCsv.click();
    await download;
    await expect(audit.exportedToast).toBeVisible();
  });

  await show.step('filter', async () => {
    await audit.category.selectOption({ label: 'Suspensions' });
    await expect(audit.noResults('suspensions')).toBeVisible();
  });

  await show.step('show-all', async () => {
    await audit.showAll.click();
    await expect(audit.rows).toHaveCount(2);
  });

  await show.card('closing', 'closing', [
    'When, who and what, for every admin action',
    'Filter by category and export to CSV',
    'System Admins only',
  ]);
  await show.finish();
});
