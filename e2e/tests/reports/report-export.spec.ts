// Traces to: L2-128 (docs/detailed-designs/reports/reports-dashboard, ADR 0030)
import { readFileSync } from 'node:fs';

import { expect, test } from '../../fixtures/app';
import { seedReportData } from '../../fixtures/report-data';
import { ReportsPage } from '../../pages/reports.page';

test.use({ timezoneId: 'America/Toronto' });

test.describe('Export a report', () => {
  // L2-128 AC1: Given Staff viewing the report, when they choose Export CSV, then the figures, both charts and both
  // tables download one section after another for the same filters. L2-128 AC3: every value is quoted and a value
  // starting like a formula is guarded. L2-128 AC4: while it is prepared, Export CSV is busy and cannot be pressed
  // again.
  test('Staff export the report for the filters shown', async ({ page, api, axe }) => {
    const { staff } = seedReportData(api);
    api.events.add({ title: '=SUM(A1)', city: 'Toronto' }, -1);
    const reports = new ReportsPage(page);
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    api.on('GET', '/api/reports/export.csv', async (route) => {
      await held;
      await api.fallback(route);
    });
    await api.signInAs(staff, '/reports');
    await reports.open('?city=Toronto&period=last-30-days');
    await expect(reports.subtitle).toContainText('Toronto · Last 30 days');

    const download = page.waitForEvent('download');
    await reports.exportCsv.click();
    await expect(reports.exportCsv).toHaveText('Exporting…');
    await expect(reports.exportCsv).toHaveAttribute('aria-busy', 'true');
    await reports.exportCsv.click({ force: true });
    await axe.check();
    release();

    const file = await download;
    expect(file.suggestedFilename()).toBe('faithtech-report-toronto-last-30-days-2026-10-21.csv');
    const lines = readFileSync((await file.path())!, 'utf8')
      .replace(/^﻿/, '')
      .split('\r\n');
    expect(lines.slice(0, 2)).toEqual([
      '"Report","FaithTech Community Reports"',
      '"City","Toronto"',
    ]);
    expect(lines).toContain('"Members","3","1 new in the last 30 days"');
    expect(lines).toContain('"RSVPs","3","100% checked in"');
    expect(lines).toContain('"Members by city"');
    expect(lines).toContain('"Oct (so far)","1"');
    expect(lines).toContain('"Toronto","1","0","1"');
    expect(lines).toContain('"\'=SUM(A1)","2026-10-20 12:00","Toronto","Held","0","0",""');
    expect(api.callsTo('GET', '/api/reports/export.csv')).toHaveLength(1);
    await expect(reports.exportCsv).toHaveText('Export CSV');
  });

  // L2-128 AC4: when the export fails, a danger toast offers Try again.
  test('a failed export offers Try again', async ({ page, api, axe }) => {
    const { staff } = seedReportData(api);
    const reports = new ReportsPage(page);
    let fail = true;
    api.on('GET', '/api/reports/export.csv', (route) =>
      fail ? route.abort('failed') : api.fallback(route),
    );
    await api.signInAs(staff, '/reports');
    await expect(reports.figure('Members')).toContainText('9');

    await reports.exportCsv.click();

    const toast = reports.toast('Couldn’t export the report. Try again.');
    await expect(toast).toBeVisible();
    await axe.check();
    fail = false;
    const download = page.waitForEvent('download');
    await toast.getByRole('button', { name: 'Try again' }).click();
    expect((await download).suggestedFilename()).toBe(
      'faithtech-report-all-cities-last-30-days-2026-10-21.csv',
    );
  });
});
