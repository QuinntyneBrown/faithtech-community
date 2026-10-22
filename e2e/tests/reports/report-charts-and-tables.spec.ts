// Traces to: L2-101 (docs/detailed-designs/reports/reports-dashboard, ADR 0026)
import { expect, test } from '../../fixtures/app';
import { seedReportData } from '../../fixtures/report-data';
import { ReportsPage } from '../../pages/reports.page';

test.use({ timezoneId: 'America/Toronto' });

test.describe('Report charts and tables', () => {
  // L2-101 AC1: Members by city shows the four largest cities and "Other"; L2-101 AC2: New members by month shows
  // each month of the period with the current one "so far"; L2-101 AC3: each bar's row text carries its label and
  // value, and the track is hidden from assistive technology.
  test('the charts show their rows as text with hidden bar tracks', async ({ page, api, axe }) => {
    const { staff } = seedReportData(api);
    const reports = new ReportsPage(page);

    await api.signInAs(staff, '/reports');

    await expect(reports.chart('Members by city')).toBeVisible();
    expect(await reports.chartRows('Members by city')).toEqual([
      'Toronto 3',
      'Halifax 2',
      'Vancouver 2',
      'Austin 1',
      'Other 1',
    ]);
    expect(await reports.chartRows('New members by month')).toEqual(['Sep 1', 'Oct so far 2']);
    await expect(reports.chart('Members by city').locator('[aria-hidden="true"]')).toHaveCount(5);
    await axe.check();
  });

  test('one city charts that city alone', async ({ page, api }) => {
    const { staff } = seedReportData(api);
    const reports = new ReportsPage(page);

    await api.signInAs(staff, '/reports');
    await reports.open('?city=Toronto&period=last-30-days');
    await expect(reports.subtitle).toContainText('Toronto · Last 30 days');
    expect(await reports.chartRows('Members by city')).toEqual(['Toronto 3']);
    expect(await reports.chartRows('New members by month')).toEqual(['Sep 0', 'Oct so far 1']);
  });

  // L2-101 AC4: Partner pipeline by city counts each stage by the owner's home city, "No city" last.
  // L2-101 AC5: Events and attendance lists the period and the next 30 days, newest first, with going and checked
  // in with its rate, or Upcoming or Cancelled; each title links to the event.
  test('the tables list the pipeline by city and the events with attendance', async ({
    page,
    api,
    axe,
  }) => {
    const { staff } = seedReportData(api);
    const reports = new ReportsPage(page);

    await api.signInAs(staff, '/reports');

    await expect(reports.card('Partner pipeline by city')).toBeVisible();
    expect(await reports.tableRows('Partner pipeline by city')).toEqual([
      ['Austin', '0', '1', '0'],
      ['Calgary', '0', '0', '0'],
      ['Halifax', '0', '0', '0'],
      ['Toronto', '1', '0', '1'],
      ['Vancouver', '0', '0', '0'],
      ['No city', '0', '0', '1'],
    ]);
    expect(await reports.tableRows('Events and attendance')).toEqual([
      ['Toronto Prayer & Planning', 'Wed 28 Oct', 'Toronto', '4', 'Upcoming'],
      ['Austin Faith & AI Panel', 'Sun 18 Oct', 'Austin', '—', 'Cancelled'],
      ['Toronto Builders Night', 'Fri 16 Oct', 'Toronto', '3', '3 (100%)'],
      ['Vancouver Builders Night', 'Fri 9 Oct', 'Vancouver', '5', '4 (80%)'],
    ]);
    await expect(reports.eventLink('Toronto Builders Night')).toHaveAttribute(
      'href',
      '/events/event-2',
    );
    await expect(
      reports.card('Partner pipeline by city').getByRole('rowheader', { name: 'Toronto' }),
    ).toBeVisible();
    await axe.check();
  });
});
