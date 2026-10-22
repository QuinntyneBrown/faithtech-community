// Traces to: L2-099 AC6, L2-101 AC6 (docs/detailed-designs/reports/reports-dashboard)
import { expect, test } from '../../fixtures/app';
import { seedReportData } from '../../fixtures/report-data';
import { ReportsPage } from '../../pages/reports.page';
import { BREAKPOINTS, hasHorizontalScroll } from '../../pages/viewport';

test.use({ timezoneId: 'America/Toronto' });

test.describe('Reports on a phone', () => {
  // Given an XS viewport, then the filters sit above the report, the figures and charts are one column, and the
  // tables scroll inside their own region, without horizontal page scroll.
  test('at XS the report is one column with no horizontal page scroll', async ({
    page,
    api,
    axe,
  }) => {
    const { staff } = seedReportData(api);
    const reports = new ReportsPage(page);
    await page.setViewportSize(BREAKPOINTS.xs);

    await api.signInAs(staff, '/reports');

    await expect(reports.figure('Members')).toContainText('9');
    const period = await reports.period.boundingBox();
    const members = await reports.figure('Members').boundingBox();
    const events = await reports.figure('Events held').boundingBox();
    expect(members!.y).toBeGreaterThan(period!.y);
    expect(events!.y).toBeGreaterThan(members!.y);
    const chart = await reports.chart('Members by city').boundingBox();
    const pipeline = await reports.card('Partner pipeline by city').boundingBox();
    expect(chart!.y).toBeGreaterThan(pipeline!.y);
    expect(await hasHorizontalScroll(page)).toBe(false);
    await axe.check();
  });
});
