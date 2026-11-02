import { expect, test } from '../../../e2e/fixtures/app';
import { EventHubPage } from '../../../e2e/pages/event-hub.page';
import { HubQrFullScreen, ShareHubDialog } from '../../../e2e/pages/share-hub.dialog';
import { Presenter } from '../presenter';

const DESKTOP = { width: 1280, height: 720 };

// The window is the projector: Show full screen asks the browser for full screen, which headless Chromium sizes
// to its window (800 x 600 unless told otherwise).
test.use({
  timezoneId: 'America/Toronto',
  viewport: DESKTOP,
  launchOptions: { args: ['--window-size=1280,720'] },
});
const TITLE = 'Toronto Builders Night';

// Journey: share a hub by QR code (docs/detailed-designs/events/share-hub-by-qr-code, L2-193 to L2-195).
test('share-hub-by-qr-code', async ({ page, api }) => {
  const show = await Presenter.start(page, 'share-hub-by-qr-code');
  const home = new EventHubPage(page);
  const share = new ShareHubDialog(page, TITLE);
  const full = new HubQrFullScreen(page, TITLE);
  const event = api.events.add({
    title: TITLE,
    startsAt: '2026-11-06T23:30:00.000Z',
    endsAt: '2026-11-07T02:00:00.000Z',
    venue: 'Kestrel Labs, 220 King St W, Toronto',
    visibility: 'Public',
  });
  api.events.hubs.add(event);
  api.events.hubs.fill(event.id, 'Hero', { subtitle: 'A night of building for the city' });
  const grace = api.addAccount({
    email: 'grace@example.org',
    name: 'Grace Okonkwo',
    roles: ['CityLead'],
  });

  await show.card(
    'opening',
    'opening',
    ['Share a hub by QR code', 'Recorded against a local fake API · synthetic people and events'],
    () => api.signInAs(grace, `/events/${event.id}/hub`),
  );

  await show.step(
    'home',
    async () => {
      await expect(home.share).toBeVisible();
      await home.share.scrollIntoViewIfNeeded();
    },
    { position: 'top' },
  );

  await show.step(
    'draft',
    async () => {
      await home.share.click();
      await expect(share.draftNote).toBeVisible();
    },
    { position: 'top' },
  );

  await show.step(
    'publish',
    async () => {
      await share.done.click();
      await home.publish.click();
      await expect(home.toast('Hub published')).toBeVisible();
    },
    { position: 'top' },
  );

  await show.step(
    'share',
    async () => {
      await home.share.click();
      await expect(share.qrCode).toBeVisible();
      await expect(share.draftNote).toHaveCount(0);
    },
    { poster: true, position: 'top' },
  );

  await show.step(
    'full',
    async () => {
      await share.showFullScreen.click();
      await expect(full.qrCode).toBeVisible();
    },
    { position: 'top' },
  );

  await show.step(
    'escape',
    async () => {
      await page.keyboard.press('Escape');
      await expect(full.view).toHaveCount(0);
      await expect(share.showFullScreen).toBeFocused();
    },
    { position: 'top' },
  );

  await show.step(
    'download',
    async () => {
      const download = page.waitForEvent('download');
      await share.download.click();
      expect((await download).suggestedFilename()).toBe('toronto-builders-night-hub-qr-code.png');
    },
    { position: 'top' },
  );

  await show.card('closing', 'closing', [
    'Share on the hub home',
    'Full screen for the projector',
    'A PNG for the welcome table',
  ]);
  await show.finish();
});
