// Traces to: L2-098, L2-102 AC4, L2-045 AC4 and AC5 (docs/detailed-designs/reports/reports-dashboard)
import { expect, test } from '../../fixtures/app';
import { seedReportData } from '../../fixtures/report-data';
import { AppShell } from '../../pages/app-shell.page';
import { ReportsPage } from '../../pages/reports.page';
import { BREAKPOINTS } from '../../pages/viewport';

test.use({ timezoneId: 'America/Toronto' });

test.describe('Reports access', () => {
  // L2-098 AC1: Given Staff or a System Admin, when they open /reports, then the report is shown.
  // L2-098 AC5: the report offers no write action.
  for (const who of ['staff', 'admin'] as const) {
    test(`${who === 'staff' ? 'Staff' : 'a System Admin'} sees the report`, async ({
      page,
      api,
      axe,
    }) => {
      const data = seedReportData(api);
      const reports = new ReportsPage(page);

      await api.signInAs(data[who], '/reports');

      await expect(reports.heading).toHaveText('Reports');
      await expect(reports.figure('Members')).toContainText('9');
      await expect(page.getByRole('main').getByRole('button')).toHaveText(['Apply', 'Export CSV']);
      const writes = api.calls.filter(
        (c) =>
          c.method !== 'GET' && c.path.startsWith('/api/') && !c.path.startsWith('/api/account/'),
      );
      expect(writes).toEqual([]);
      await axe.check();
    });
  }

  // L2-098 AC2, L2-102 AC4: Given any other signed-in member, City Leads and the other lead roles included, when
  // they open /reports, then the server answers 403 and the forbidden page is shown.
  for (const roles of [['CityLead'], ['EventLead'], ['Volunteer'], []]) {
    test(`a member with ${roles.join(', ') || 'no role'} sees the forbidden state`, async ({
      page,
      api,
      axe,
    }) => {
      seedReportData(api);
      const member = api.addAccount({ email: 'jonah@example.org', name: 'Jonah Bell', roles });
      const reports = new ReportsPage(page);

      await api.signInAs(member, '/reports');

      await expect(reports.forbidden).toBeVisible();
      await expect(reports.goHome).toHaveAttribute('href', '/');
      await expect(page.getByRole('heading', { level: 1, name: 'Reports' })).toBeAttached();
      await expect(reports.figure('Members')).toHaveCount(0);
      expect(api.callsTo('GET', '/api/reports')).toHaveLength(1);
      await axe.check();
    });
  }

  // L2-098 AC3: Given an anonymous visitor, when they open /reports, then they are sent to sign in.
  test('an anonymous visitor is sent to sign in', async ({ page }) => {
    await page.goto('/reports');

    await expect(page).toHaveURL(`/sign-in?returnUrl=${encodeURIComponent('/reports')}`);
  });

  // L2-098 AC4, L2-045 AC5: Reports is a secondary section for Staff and System Admin only, reached through More
  // from MD and in the top bar from 2XL.
  test('Staff reach Reports through More on a tablet', async ({ page, api, axe }) => {
    const data = seedReportData(api);
    const shell = new AppShell(page);
    const reports = new ReportsPage(page);
    await page.setViewportSize(BREAKPOINTS.md);
    await api.signInAs(data.staff);

    await expect(shell.navLink('Reports')).toBeHidden();
    await shell.moreLink.click();
    await shell.drawerLink('Reports').click();

    await expect(page).toHaveURL('/reports');
    await expect(reports.heading).toHaveText('Reports');
    await axe.check();
  });
});
