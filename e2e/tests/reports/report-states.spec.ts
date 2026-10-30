// Traces to: L2-127 (docs/detailed-designs/reports/reports-dashboard)
import { expect, test } from '../../fixtures/app';
import { seedReportData } from '../../fixtures/report-data';
import { ReportsPage } from '../../pages/reports.page';

test.use({ timezoneId: 'America/Toronto' });

test.describe('Report states', () => {
  // L2-127 AC1: Given the report is loading, then skeletons stand in for the figures, charts and tables, and the
  // busy state is announced.
  test('while loading, skeletons stand in and the region is busy', async ({ page, api, axe }) => {
    const { staff } = seedReportData(api);
    const reports = new ReportsPage(page);
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    api.on('GET', '/api/reports', async (route) => {
      await held;
      await api.fallback(route);
    });

    await api.signInAs(staff, '/reports');

    await expect(reports.loading).toHaveAttribute('aria-busy', 'true');
    await expect(reports.heading).toHaveText('Reports');
    await expect(reports.apply).toBeVisible();
    await axe.check();
    release();
    await expect(reports.loading).toHaveCount(0);
    await expect(reports.figure('Members')).toContainText('9');
  });

  // L2-127 AC2: Given no members and no events for the filters, then it says "Nothing to report for {city} in the
  // {period}", with All cities and Last 90 days.
  test('a city with nothing in the period shows the empty state', async ({ page, api, axe }) => {
    const { staff } = seedReportData(api);
    const reports = new ReportsPage(page);
    await api.signInAs(staff, '/reports');

    await reports.open('?city=Calgary&period=last-30-days');

    await expect(reports.empty).toHaveText('Nothing to report for Calgary in the last 30 days');
    await axe.check();
    await reports.emptyAction('Last 90 days').click();
    await expect(page).toHaveURL('/reports?city=Calgary&period=last-90-days');
    await expect(reports.figure('Events held')).toContainText('1');
  });

  // L2-127 AC3: Given the report fails to load, then an error offers "Try again", which reloads the same filters.
  test('a failed load offers Try again, which reloads the same filters', async ({
    page,
    api,
    axe,
  }) => {
    const { staff } = seedReportData(api);
    const reports = new ReportsPage(page);
    let fail = true;
    api.on('GET', '/api/reports', (route) =>
      fail ? route.fulfill({ status: 500 }) : api.fallback(route),
    );
    await api.signInAs(staff, '/reports');
    await reports.open('?city=Toronto&period=this-year');

    await expect(reports.error).toBeVisible();
    await expect(page).toHaveURL('/reports?city=Toronto&period=this-year');
    await axe.check();

    fail = false;
    await reports.tryAgain.click();
    await expect(reports.subtitle).toContainText('Toronto · This year');
    await expect(reports.figure('Members')).toContainText('3');
    await expect(page).toHaveURL('/reports?city=Toronto&period=this-year');
  });
});
