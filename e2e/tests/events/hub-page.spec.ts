// Traces to: L2-163 AC1 to AC3, AC5 (docs/detailed-designs/events/preview-and-publish-hub)
import { expect, test } from '../../fixtures/app';
import { MockApi } from '../../fixtures/mock-api';
import { HubPage } from '../../pages/hub.page';

test.use({ timezoneId: 'America/Toronto' });

const DRAFT = 'This is how your hub will look. It’s a draft, so visitors can’t open it yet.';

function arrange(api: MockApi, hidden: Parameters<MockApi['events']['hubs']['add']>[1] = []) {
  const event = api.events.add({
    title: 'Toronto Builders Night',
    startsAt: '2026-11-06T23:30:00.000Z',
    endsAt: '2026-11-07T02:00:00.000Z',
    venue: 'Kestrel Labs, 220 King St W, Toronto',
    visibility: 'Public',
  });
  api.events.hubs.add(event, hidden);
  const grace = api.addAccount({
    email: 'grace@example.org',
    name: 'Grace Okonkwo',
    roles: ['CityLead'],
  });
  return { event, grace };
}

test.describe('Hub page', () => {
  // L2-163 AC1, AC2: the shown sections in the hub's order, under the preview banner.
  test('a lead previews a draft hub with only its ready, visible sections', async ({
    page,
    api,
    axe,
  }) => {
    const { event, grace } = arrange(api, ['Venue']);
    api.events.hubs.fill(event.id, 'Hero', { subtitle: 'A night of building for the city' });
    api.events.hubs.fill(event.id, 'Agenda', {
      items: [{ startsAt: '2026-11-06T23:30:00.000Z', title: 'Doors open', detail: null }],
    });
    const hub = new HubPage(page);
    await api.signInAs(grace, `/public/events/${event.id}/hub`);

    await expect(hub.banner).toContainText('Preview');
    await expect(hub.banner).toContainText(DRAFT);
    await expect(hub.backToHubHome).toHaveAttribute('href', `/events/${event.id}/hub`);
    await expect(hub.sectionHeadings).toHaveText(['Toronto Builders Night', 'Agenda', 'Giving']);
    await expect(hub.text('A night of building for the city')).toBeVisible();
    await expect(page).toHaveTitle(/Toronto Builders Night hub/);
    await axe.check();
  });

  // L2-163 AC2: a published hub says visitors see it.
  test('a published hub’s preview says visitors see it', async ({ page, api }) => {
    const { event, grace } = arrange(api);
    api.events.hubs.publish(event.id);
    const hub = new HubPage(page);
    await api.signInAs(grace, `/public/events/${event.id}/hub`);

    await expect(hub.banner).toContainText('This is your published hub, as visitors see it.');
  });

  // L2-163 AC3: with nothing to show, the page says so.
  test('a hub with every section hidden says there is nothing to show yet', async ({
    page,
    api,
    axe,
  }) => {
    const { event, grace } = arrange(api, [
      'Hero',
      'Agenda',
      'Venue',
      'People',
      'Links',
      'Giving',
      'UpcomingEvents',
    ]);
    const hub = new HubPage(page);
    await api.signInAs(grace, `/public/events/${event.id}/hub`);

    await expect(hub.nothingYet).toBeVisible();
    await expect(
      hub.text('Fill in a section on the hub home and it will appear here.'),
    ).toBeVisible();
    await expect(hub.sectionHeadings).toHaveCount(0);
    await axe.check();
  });

  // L2-163 AC5: without the capability, or without a hub, the page is not available.
  test('a member without the capability, or an event without a hub, is not available', async ({
    page,
    api,
    axe,
  }) => {
    const { event } = arrange(api);
    const noHub = api.events.add({ title: 'Prayer Breakfast', visibility: 'Public' });
    const ruth = api.addAccount({
      email: 'ruth@example.org',
      name: 'Ruth Alvarez',
      roles: ['Staff'],
    });
    const hub = new HubPage(page);
    await api.signInAs(ruth, `/public/events/${event.id}/hub`);

    await expect(hub.notAvailable).toBeVisible();
    await expect(hub.text('It may not be published yet, or the link may be wrong.')).toBeVisible();
    await axe.check();

    await hub.open(noHub.id);
    await expect(hub.notAvailable).toBeVisible();
  });

  // The failed state: Try again loads the hub.
  test('a failed load offers Try again, which loads the hub', async ({ page, api }) => {
    const { event, grace } = arrange(api);
    api.events.hubs.failNextLoad();
    const hub = new HubPage(page);
    await api.signInAs(grace, `/public/events/${event.id}/hub`);

    await expect(hub.failed).toBeVisible();
    await hub.tryAgain.click();
    await expect(hub.sectionHeadings.first()).toHaveText('Toronto Builders Night');
  });
});
