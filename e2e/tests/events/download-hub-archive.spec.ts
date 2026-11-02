// Traces to: L2-196, L2-198 (docs/detailed-designs/events/download-hub-archive)
import { readFileSync } from 'node:fs';
import { expect, test } from '../../fixtures/app';
import { MockApi } from '../../fixtures/mock-api';
import { EventHubPage } from '../../pages/event-hub.page';
import { BREAKPOINTS, hasHorizontalScroll } from '../../pages/viewport';

test.use({ timezoneId: 'America/Toronto' });

const TITLE = 'Toronto Builders Night';
const FILE = 'toronto-builders-night-hub.zip';

/** Toronto Builders Night with a draft hub, and Grace, a City Lead who manages hubs. */
function arrange(api: MockApi) {
  const event = api.events.add({
    title: TITLE,
    startsAt: '2026-11-06T23:30:00.000Z',
    endsAt: '2026-11-07T02:00:00.000Z',
    venue: 'Kestrel Labs, 220 King St W, Toronto',
    visibility: 'Public',
  });
  api.events.hubs.add(event);
  const grace = api.addAccount({
    email: 'grace@example.org',
    name: 'Grace Okonkwo',
    roles: ['CityLead'],
  });
  return { event, grace };
}

test.describe('Download a hub archive', () => {
  // L2-196 AC1, AC3, AC5: Download archive sits after Share on a draft hub; the zip is saved under the event's slug and
  // the request carries the browser's time zone.
  test('a lead downloads the hub as a zip named after the event', async ({ page, api, axe }) => {
    const { event, grace } = arrange(api);
    const home = new EventHubPage(page);
    await api.signInAs(grace, `/events/${event.id}/hub`);
    await expect(home.downloadArchive).toBeVisible();
    expect(await home.cardActionNames()).toEqual(
      expect.arrayContaining(['Share', 'Download archive']),
    );
    const names = await home.cardActionNames();
    expect(names.indexOf('Download archive')).toBe(names.indexOf('Share') + 1);
    await axe.check();

    const download = page.waitForEvent('download');
    await home.downloadArchive.click();
    const file = await download;

    expect(file.suggestedFilename()).toBe(FILE);
    const bytes = readFileSync((await file.path())!);
    expect([...bytes.subarray(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    await expect(home.toast('Archive downloaded')).toContainText(`${FILE} is in your downloads.`);
    expect(api.events.hubs.archiveRequests).toEqual([
      { eventId: event.id, timeZone: 'America/Toronto' },
    ]);
  });

  // L2-196 AC2, AC6: while the zip is on its way the button is busy and a second press sends nothing.
  test('while the archive is prepared the button is busy and sends nothing more', async ({
    page,
    api,
    axe,
  }) => {
    const { event, grace } = arrange(api);
    const home = new EventHubPage(page);
    await api.signInAs(grace, `/events/${event.id}/hub`);
    const release = api.events.hubs.holdNextArchive();

    await home.downloadArchive.click();

    await expect(home.downloadArchive).toHaveText(/Preparing archive…/);
    await expect(home.downloadArchive).toHaveAttribute('aria-busy', 'true');
    await home.downloadArchive.click({ force: true });
    await axe.check();
    const download = page.waitForEvent('download');
    release();
    await download;
    await expect(home.downloadArchive).toHaveText(/^\s*Download archive\s*$/);
    expect(api.events.hubs.archiveRequests).toHaveLength(1);
  });

  // L2-196 AC4: a failure leaves the button ready and offers Try again, which asks again.
  test('a failed archive offers Try again, which downloads it', async ({ page, api }) => {
    const { event, grace } = arrange(api);
    const home = new EventHubPage(page);
    await api.signInAs(grace, `/events/${event.id}/hub`);
    api.events.hubs.failNextArchive();

    await home.downloadArchive.click();

    await expect(home.toast('We couldn’t make the archive')).toContainText(
      'Check your connection and try again.',
    );
    await expect(home.downloadArchive).toHaveText(/^\s*Download archive\s*$/);
    const download = page.waitForEvent('download');
    await home.toastAction('We couldn’t make the archive', 'Try again').click();
    expect((await download).suggestedFilename()).toBe(FILE);
    expect(api.events.hubs.archiveRequests).toHaveLength(2);
  });

  // L2-196 AC6: on a phone the action wraps with the others; no sideways scroll, light and dark.
  test('on a phone Download archive wraps with the card actions, in light and dark', async ({
    page,
    api,
    axe,
  }) => {
    const { event, grace } = arrange(api);
    const home = new EventHubPage(page);
    await page.setViewportSize(BREAKPOINTS.xs);
    await api.signInAs(grace, `/events/${event.id}/hub`);

    await expect(home.downloadArchive).toBeInViewport();
    expect(await hasHorizontalScroll(page)).toBe(false);
    await axe.check();
    await page.emulateMedia({ colorScheme: 'dark' });
    await axe.check();
  });
});
