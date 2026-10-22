import { expect, test } from '../../../e2e/fixtures/app';
import { seedReportData } from '../../../e2e/fixtures/report-data';
import { AppShell } from '../../../e2e/pages/app-shell.page';
import { ReportsPage } from '../../../e2e/pages/reports.page';
import { Presenter } from '../presenter';

test.use({ timezoneId: 'America/Toronto' });

// Journey: the Reports dashboard (docs/detailed-designs/reports/reports-dashboard, L2-123 to L2-129).
test('reports-dashboard', async ({ page, api }) => {
  const show = await Presenter.start(page, 'reports-dashboard');
  const shell = new AppShell(page);
  const reports = new ReportsPage(page);
  const { staff } = seedReportData(api);
  await api.freezeBrowserClock();

  await show.card(
    'opening',
    'opening',
    ['City numbers at a glance', 'Recorded against a local fake API · synthetic data'],
    () => api.signInAs(staff, '/'),
  );

  await show.step('nav', async () => {
    await expect(shell.navLink('Reports')).toBeVisible();
    await page.waitForTimeout(1500);
    await shell.navLink('Reports').click();
    await expect(reports.heading).toHaveText('Reports');
    await expect(reports.subtitle).toContainText('All cities · Last 30 days');
  });

  await show.step(
    'figures',
    async () => {
      await expect(reports.figure('Members')).toContainText('+3 in the last 30 days');
      await expect(reports.figure('RSVPs')).toContainText('88% checked in');
      await expect(reports.figure('Partners confirmed')).toContainText('of 4 in the pipeline');
    },
    { poster: true },
  );

  await show.step('charts', async () => {
    await reports.chart('Members by city').scrollIntoViewIfNeeded();
    await expect(reports.chart('New members by month')).toBeVisible();
  });

  await show.step('tables', async () => {
    await reports.card('Partner pipeline by city').scrollIntoViewIfNeeded();
    await page.waitForTimeout(2500);
    await reports.card('Events and attendance').scrollIntoViewIfNeeded();
    await expect(reports.eventLink('Toronto Builders Night')).toBeVisible();
  });

  await show.step('filter', async () => {
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await page.waitForTimeout(800);
    await reports.city.selectOption({ label: 'Toronto' });
    await page.waitForTimeout(600);
    await reports.period.selectOption({ label: 'Last 90 days' });
    await page.waitForTimeout(600);
    await reports.apply.click();
    await expect(page).toHaveURL('/reports?city=Toronto&period=last-90-days');
    await expect(reports.subtitle).toContainText('Toronto · Last 90 days');
    await expect(reports.figure('Members')).toContainText('3');
  });

  await show.step('export', async () => {
    const download = page.waitForEvent('download');
    await reports.exportCsv.click();
    expect((await download).suggestedFilename()).toBe(
      'faithtech-report-toronto-last-90-days-2026-10-21.csv',
    );
  });

  await show.card('closing', 'closing', [
    'For Staff and System Admin',
    'Five figures, two charts and two tables',
    'Filter by city and period, bookmark it, export it',
  ]);
  await show.finish();
});
