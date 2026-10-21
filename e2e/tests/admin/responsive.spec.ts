// Traces to: L2-040, L2-041 with L2-045 AC1 (docs/detailed-designs/platform/responsive-layout-and-theming)
import { expect, test } from '../../fixtures/app';
import { AdminUsersPage } from '../../pages/admin-users.page';
import { AuditLogPage } from '../../pages/audit-log.page';
import {
  BREAKPOINTS,
  BreakpointName,
  hasHorizontalScroll,
  undersizedTargets,
} from '../../pages/viewport';

for (const name of Object.keys(BREAKPOINTS) as BreakpointName[]) {
  test(`the admin screens fit and keep 24px targets at ${name}`, async ({ page, api }) => {
    await page.setViewportSize(BREAKPOINTS[name]);
    const priya = api.addAccount({
      email: 'priya@example.org',
      name: 'Priya Shah',
      roles: ['SystemAdmin'],
    });
    api.addAccount({
      email: 'grace.okonkwo@example.org',
      name: 'Grace Okonkwo',
      roles: ['CityLead', 'Staff'],
    });
    api.addAuditEntry({ action: 'role.granted', summary: 'Granted City Lead to Esther Nakamura' });
    await api.signInAs(priya, '/admin/users');

    await expect(new AdminUsersPage(page).rows).toHaveCount(2);
    expect(await hasHorizontalScroll(page), 'admin users').toBe(false);
    expect(await undersizedTargets(page), 'admin users').toEqual([]);

    await new AuditLogPage(page).open();
    await expect(new AuditLogPage(page).rows).toHaveCount(1);
    expect(await hasHorizontalScroll(page), 'audit log').toBe(false);
    expect(await undersizedTargets(page), 'audit log').toEqual([]);
  });
}
