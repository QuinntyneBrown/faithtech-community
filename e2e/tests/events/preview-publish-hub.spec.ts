// Traces to: L2-163 AC4, L2-164, L2-165 (docs/detailed-designs/events/preview-and-publish-hub)
import { expect, test } from '../../fixtures/app';
import { MockApi } from '../../fixtures/mock-api';
import { EventHubPage } from '../../pages/event-hub.page';
import { HubPage } from '../../pages/hub.page';
import { HubSectionDialog } from '../../pages/hub-section.dialog';

test.use({ timezoneId: 'America/Toronto' });

const WIZARDS = [
  'Hero',
  'Agenda',
  'Venue',
  'People',
  'Submission and feedback',
  'Giving',
  'Upcoming events',
];

function arrange(api: MockApi) {
  const event = api.events.add({
    title: 'Toronto Builders Night',
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

test.describe('Preview and publish a hub', () => {
  // L2-163 AC4: Preview on the hub home opens the hub page, and Back to hub home returns.
  test('Preview on the hub home opens the hub page', async ({ page, api }) => {
    const { event, grace } = arrange(api);
    const home = new EventHubPage(page);
    const hub = new HubPage(page);
    await api.signInAs(grace, `/events/${event.id}/hub`);

    await home.preview.click();
    await expect(page).toHaveURL(new RegExp(`/public/events/${event.id}/hub$`));
    await expect(hub.banner).toContainText('Preview');

    await hub.backToHubHome.click();
    await expect(home.heading).toHaveText('Event hub');
  });

  // L2-163 AC4: every wizard has a Preview link that opens the hub page in a new tab.
  test('every section wizard has a Preview link to the hub page in a new tab', async ({
    page,
    api,
    axe,
  }) => {
    const { event, grace } = arrange(api);
    const home = new EventHubPage(page);
    await api.signInAs(grace, `/events/${event.id}/hub`);

    for (const title of WIZARDS) {
      await home.openWizard(title);
      const wizard = new HubSectionDialog(page, title);
      await expect(wizard.preview).toHaveAttribute('href', `/public/events/${event.id}/hub`);
      await expect(wizard.preview).toHaveAttribute('target', '_blank');
      if (title === 'Hero') await axe.check();
      await wizard.close.click();
      await expect(wizard.dialog).toBeHidden();
    }
  });
});
