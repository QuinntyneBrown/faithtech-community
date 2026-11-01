import { expect, test } from '../../../e2e/fixtures/app';
import { EventHubPage } from '../../../e2e/pages/event-hub.page';
import { HubPage } from '../../../e2e/pages/hub.page';
import { HubSectionDialog } from '../../../e2e/pages/hub-section.dialog';
import { UnpublishHubDialog } from '../../../e2e/pages/unpublish-hub.dialog';
import { Presenter } from '../presenter';

test.use({ timezoneId: 'America/Toronto' });

// Journey: preview and publish a hub (docs/detailed-designs/events/preview-and-publish-hub, L2-163 to L2-165).
test('preview-and-publish-hub', async ({ page, api, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const show = await Presenter.start(page, 'preview-and-publish-hub');
  const home = new EventHubPage(page);
  const hub = new HubPage(page);
  const hero = new HubSectionDialog(page, 'Hero');
  const unpublish = new UnpublishHubDialog(page);
  const event = api.events.add({
    title: 'Toronto Builders Night',
    startsAt: '2026-11-06T23:30:00.000Z',
    endsAt: '2026-11-07T02:00:00.000Z',
    venue: 'Kestrel Labs, 220 King St W, Toronto',
    visibility: 'Public',
  });
  api.events.hubs.add(event, ['People', 'Links']);
  api.events.hubs.fill(event.id, 'Hero', { subtitle: 'A night of building for the city' });
  api.events.hubs.fill(event.id, 'Agenda', {
    items: [
      { startsAt: '2026-11-06T23:30:00.000Z', title: 'Doors open', detail: null },
      { startsAt: '2026-11-07T00:00:00.000Z', title: 'Build time', detail: null },
      { startsAt: '2026-11-07T01:15:00.000Z', title: 'Demos and feedback', detail: null },
    ],
  });
  const grace = api.addAccount({
    email: 'grace@example.org',
    name: 'Grace Okonkwo',
    roles: ['CityLead'],
  });

  await show.card(
    'opening',
    'opening',
    [
      'Preview and publish an event hub',
      'Recorded against a local fake API · synthetic people and events',
    ],
    () => api.signInAs(grace, `/events/${event.id}/hub`),
  );

  await show.step('home', async () => {
    await expect(home.heading).toHaveText('Event hub');
    await expect(home.publish).toBeVisible();
  });

  await show.step(
    'preview',
    async () => {
      await home.preview.click();
      await expect(hub.banner).toContainText('Preview');
    },
    { poster: true },
  );

  await show.step('scroll', async () => {
    await hub.sectionHeadings.last().scrollIntoViewIfNeeded();
  });

  await show.step('wizard', async () => {
    await hub.backToHubHome.click();
    await home.openWizard('Hero');
    await expect(hero.preview).toBeVisible();
  });

  await show.step('publish', async () => {
    await hero.close.click();
    await home.publish.click();
    await expect(home.toast('Hub published')).toBeVisible();
    await expect(home.status).toHaveText('Published');
  });

  await show.step('copy', async () => {
    await home.copyLink.click();
    await expect(home.toast('Link copied')).toBeVisible();
  });

  await show.step('unpublish', async () => {
    await home.unpublish.click();
    await expect(unpublish.dialog).toBeVisible();
  });

  await show.step('unpublished', async () => {
    await unpublish.confirm.click();
    await expect(home.toast('Hub unpublished')).toBeVisible();
    await expect(home.status).toHaveText('Draft');
  });

  await show.card('closing', 'closing', [
    'Preview the real page from anywhere',
    'Publish in one click',
    'Unpublish keeps everything it says',
  ]);
  await show.finish();
});
