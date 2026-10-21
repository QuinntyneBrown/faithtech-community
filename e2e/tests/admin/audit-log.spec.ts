// Traces to: L2-041 (docs/detailed-designs/admin/audit-log)
import { readFile } from 'node:fs/promises';

import { expect, test } from '../../fixtures/app';
import { AuditLogPage } from '../../pages/audit-log.page';

test.describe('Audit log', () => {
  test('a System Admin reads when, who and what, filters by category and exports CSV', async ({
    page,
    api,
    axe,
  }) => {
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
    const audit = new AuditLogPage(page);
    await api.signInAs(priya, '/admin/audit-log');

    await expect(audit.rows).toHaveCount(2);
    await expect(audit.rows.first()).toContainText('Priya Shah');
    await expect(audit.rows.first()).toContainText('Granted City Lead to Esther Nakamura');
    await axe.check();

    const download = page.waitForEvent('download');
    await audit.exportCsv.click();
    const csv = await readFile((await (await download).path())!, 'utf8');
    expect(csv).toContain('Granted Staff to Daniel Reyes');

    await audit.category.selectOption({ label: 'Suspensions' });
    await expect(audit.noResults('suspensions')).toBeVisible();
    expect(api.callsTo('GET', '/api/admin/audit').length).toBeGreaterThan(1);
    await axe.check();
    await audit.showAll.click();
    await expect(audit.rows).toHaveCount(2);
  });

  test('shows when nothing has been recorded yet', async ({ page, api, axe }) => {
    const priya = api.addAccount({ email: 'priya@example.org', roles: ['SystemAdmin'] });
    const audit = new AuditLogPage(page);
    await api.signInAs(priya, '/admin/audit-log');

    await expect(audit.empty).toBeVisible();
    await axe.check();
  });

  test('anyone else is refused', async ({ page, api }) => {
    const daniel = api.addAccount({ email: 'daniel@example.org', roles: ['Staff'] });
    const audit = new AuditLogPage(page);
    await api.signInAs(daniel, '/admin/audit-log');

    await expect(audit.forbidden).toBeVisible();
    await expect(audit.exportCsv).toHaveCount(0);
  });
});
