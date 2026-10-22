// Traces to: L2-125 (docs/detailed-designs/reports/reports-dashboard, ADR 0030)
import { expect, test } from '../../fixtures/app';
import { addPrivateContacts, seedReportData } from '../../fixtures/report-data';
import { ReportsPage } from '../../pages/reports.page';

test.use({ timezoneId: 'America/Toronto' });

test.describe('Report figures', () => {
  // L2-125 AC1 to AC5, AC7: each figure follows its definition, with unverified and suspended members, the merged
  // (archived) partner, the cancelled event, the old event and walk-ins excluded.
  test('the five figures and their context lines for All cities', async ({ page, api, axe }) => {
    const { staff } = seedReportData(api);
    const reports = new ReportsPage(page);

    await api.signInAs(staff, '/reports');

    expect(await reports.figureText('Members')).toBe('Members 9 +3 in the last 30 days');
    expect(await reports.figureText('Events held')).toBe('Events held 2 1 cancelled');
    expect(await reports.figureText('RSVPs')).toBe('RSVPs 8 88% checked in');
    expect(await reports.figureText('Partners confirmed')).toBe(
      'Partners confirmed 2 of 4 in the pipeline',
    );
    expect(await reports.figureText('Announcements')).toBe('Announcements 1 sent by leads');
    await axe.check();
  });

  // L2-125 AC1, AC4, AC5: one city narrows members by home city, events by city, partners by owner city and
  // announcements by author city; "No city" partners count only under All cities.
  test('one city narrows every figure', async ({ page, api }) => {
    const { staff } = seedReportData(api);
    const reports = new ReportsPage(page);

    await api.signInAs(staff, '/reports');
    await reports.open('?city=Toronto&period=last-30-days');
    await expect(reports.subtitle).toContainText('Toronto · Last 30 days');

    expect(await reports.figureText('Members')).toBe('Members 3 +1 in the last 30 days');
    expect(await reports.figureText('Events held')).toBe('Events held 1 0 cancelled');
    expect(await reports.figureText('RSVPs')).toBe('RSVPs 3 100% checked in');
    expect(await reports.figureText('Partners confirmed')).toBe(
      'Partners confirmed 1 of 2 in the pipeline',
    );
    expect(await reports.figureText('Announcements')).toBe('Announcements 1 sent by leads');
  });

  // L2-125 AC1: All time hides "+N", where every member would be new; L2-125 AC3: the rate shows only when there
  // are RSVPs.
  test('All time hides the new-members line and widens the window', async ({ page, api }) => {
    const { staff } = seedReportData(api);
    const reports = new ReportsPage(page);

    await api.signInAs(staff, '/reports');
    await reports.open('?city=&period=all-time');
    await expect(reports.subtitle).toContainText('All cities · All time');

    expect(await reports.figureText('Members')).toBe('Members 9');
    expect(await reports.figureText('Events held')).toBe('Events held 3 1 cancelled');
    expect(await reports.figureText('RSVPs')).toBe('RSVPs 14 93% checked in');
    expect(await reports.figureText('Announcements')).toBe('Announcements 2 sent by leads');
  });

  // L2-125 AC6: Given a lead's private contacts with emails and cities, when the report runs, then they are never
  // read or counted: every number is unchanged and nothing of them appears.
  test('private contacts never change the report or appear in it', async ({ page, api }) => {
    const { staff, grace } = seedReportData(api);
    const reports = new ReportsPage(page);
    await api.signInAs(staff, '/reports');
    await expect(reports.figure('Members')).toContainText('9');
    const before = await page.getByRole('main').innerText();

    addPrivateContacts(api, grace.profileId);
    await page.reload();
    await expect(reports.figure('Members')).toContainText('9');

    expect(await page.getByRole('main').innerText()).toBe(before);
    for (const secret of ['Harriet', 'harriet@secret.example', 'Quentin', 'Saskatoon']) {
      await expect(page.getByRole('main')).not.toContainText(secret);
    }
    expect(await reports.cityOptions()).not.toContain('Saskatoon');
  });
});
