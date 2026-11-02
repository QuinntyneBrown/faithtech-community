import { expect, test } from '../../../e2e/fixtures/app';
import { EventHubPage } from '../../../e2e/pages/event-hub.page';
import { Presenter } from '../presenter';

const DESKTOP = { width: 1280, height: 720 };

test.use({ timezoneId: 'America/Toronto', viewport: DESKTOP });
const TITLE = 'Toronto Builders Night';
const FILE = 'toronto-builders-night-hub.zip';

// Journey: download a hub archive (docs/detailed-designs/events/download-hub-archive, L2-196 to L2-198).
test('download-hub-archive', async ({ page, api }) => {
  const show = await Presenter.start(page, 'download-hub-archive');
  const home = new EventHubPage(page);
  const event = api.events.add({
    title: TITLE,
    startsAt: '2026-11-06T23:30:00.000Z',
    endsAt: '2026-11-07T02:00:00.000Z',
    venue: 'Kestrel Labs, 220 King St W, Toronto',
    visibility: 'Public',
  });
  api.events.hubs.add(event);
  api.events.hubs.fill(event.id, 'Hero', { subtitle: 'A night of building for the city' });
  api.events.hubs.publish(event.id);
  const grace = api.addAccount({
    email: 'grace@example.org',
    name: 'Grace Okonkwo',
    roles: ['CityLead'],
  });

  await show.card(
    'opening',
    'opening',
    ['Download a hub archive', 'Recorded against a local fake API · synthetic people and events'],
    () => api.signInAs(grace, `/events/${event.id}/hub`),
  );

  await show.step(
    'home',
    async () => {
      await expect(home.downloadArchive).toBeVisible();
      await home.downloadArchive.scrollIntoViewIfNeeded();
    },
    { position: 'top' },
  );

  let release = () => {};
  await show.step(
    'preparing',
    async () => {
      release = api.events.hubs.holdNextArchive();
      await home.downloadArchive.click();
      await expect(home.downloadArchive).toHaveText(/Preparing archive…/);
    },
    { position: 'top' },
  );

  await show.step(
    'downloaded',
    async () => {
      const download = page.waitForEvent('download');
      release();
      expect((await download).suggestedFilename()).toBe(FILE);
      await expect(home.toast('Archive downloaded')).toBeVisible();
    },
    { poster: true, position: 'top' },
  );

  await show.step(
    'failed',
    async () => {
      api.events.hubs.failNextArchive();
      await home.downloadArchive.click();
      await expect(home.toast('We couldn’t make the archive')).toBeVisible();
    },
    { position: 'top' },
  );

  await show.step(
    'again',
    async () => {
      const download = page.waitForEvent('download');
      await home.toastAction('We couldn’t make the archive', 'Try again').click();
      expect((await download).suggestedFilename()).toBe(FILE);
    },
    { position: 'top' },
  );

  await show.card('closing', 'closing', [
    'Download archive on the hub home',
    'One zip: a page that opens offline, its images and slides',
    'For hub managers, and audited',
  ]);
  await show.finish();
});
