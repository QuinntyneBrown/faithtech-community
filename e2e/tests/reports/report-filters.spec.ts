// Traces to: L2-124 (docs/detailed-designs/reports/reports-dashboard, ADR 0030)
import { expect, test } from '../../fixtures/app';
import { seedReportData } from '../../fixtures/report-data';
import { ReportsPage } from '../../pages/reports.page';

test.use({ timezoneId: 'America/Toronto' });

test.describe('Report filters', () => {
  // L2-124 AC1: Given no filters in the URL, then the report shows All cities and Last 30 days.
  // L2-124 AC2: the city filter offers All cities and every city of a verified member or an event, sorted.
  // L2-124 AC3: the period filter offers Last 30 days, Last 90 days, This year and All time.
  test('the report opens on All cities and the last 30 days with every city in use', async ({
    page,
    api,
    axe,
  }) => {
    const { staff } = seedReportData(api);
    const reports = new ReportsPage(page);

    await api.signInAs(staff, '/reports');

    await expect(reports.subtitle).toContainText('All cities · Last 30 days · updated');
    await expect(reports.city).toHaveValue('');
    expect(await reports.cityOptions()).toEqual([
      'All cities',
      'Austin',
      'Calgary',
      'Halifax',
      'Toronto',
      'Vancouver',
    ]);
    expect(await reports.periodOptions()).toEqual([
      'Last 30 days',
      'Last 90 days',
      'This year',
      'All time',
    ]);
    expect(api.callsTo('GET', '/api/reports')).toHaveLength(1);
    await axe.check();
  });

  // L2-124 AC4: Given new filters, when the user chooses Apply, then the report reloads for them and the URL
  // carries ?city=&period=, so the view can be bookmarked and reopened.
  test('Apply reloads the report and the URL carries the filters for a bookmark', async ({
    page,
    api,
    axe,
  }) => {
    const { staff } = seedReportData(api);
    const reports = new ReportsPage(page);
    await api.signInAs(staff, '/reports');
    await expect(reports.figure('Members')).toContainText('9');

    await reports.filter('Toronto', 'Last 90 days');

    await expect(page).toHaveURL('/reports?city=Toronto&period=last-90-days');
    await expect(reports.subtitle).toContainText('Toronto · Last 90 days');
    await expect(reports.figure('Members')).toContainText('3');
    await axe.check();

    await page.reload();
    await expect(reports.city).toHaveValue('Toronto');
    await expect(reports.period).toHaveValue('last-90-days');
    await expect(reports.figure('Members')).toContainText('3');
  });

  // L2-124 AC5: Given a URL with an unknown city or period, then the server answers 400 and the page falls back to
  // the defaults with a message.
  for (const query of ['?city=Atlantis&period=last-30-days', '?city=&period=last-week']) {
    test(`an unknown filter falls back to the defaults: ${query}`, async ({ page, api, axe }) => {
      const { staff } = seedReportData(api);
      const reports = new ReportsPage(page);

      await api.signInAs(staff, '/reports');
      await reports.open(query);

      await expect(reports.filterAlert).toBeVisible();
      await expect(page).toHaveURL('/reports?city=&period=last-30-days');
      await expect(reports.subtitle).toContainText('All cities · Last 30 days');
      await expect(reports.figure('Members')).toContainText('9');
      await axe.check();
    });
  }
});
