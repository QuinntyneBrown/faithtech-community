// Traces to: L2-163 AC4, L2-164, L2-165 (docs/detailed-designs/events/preview-and-publish-hub)
import { expect, test } from '../../fixtures/app';
import { MockApi } from '../../fixtures/mock-api';
import { EventHubPage } from '../../pages/event-hub.page';
import { HubPage } from '../../pages/hub.page';
import { HubSectionDialog } from '../../pages/hub-section.dialog';
import { UnpublishHubDialog } from '../../pages/unpublish-hub.dialog';

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

  // L2-164 AC1, AC2, L2-165 AC1: Publish makes it published now, with a toast, and refuses nothing.
  test('publishing a draft hub makes it published, with the time and a toast', async ({
    page,
    api,
    axe,
  }) => {
    const { event, grace } = arrange(api);
    const home = new EventHubPage(page);
    await api.signInAs(grace, `/events/${event.id}/hub`);
    await expect(home.linkHelp).toHaveText('Visitors can open it once you publish.');

    await home.publish.click();

    await expect(home.toast('Hub published')).toContainText('Visitors can open it now.');
    await expect(home.status).toHaveText('Published');
    await expect(home.publishedAt).toHaveText('Wed 21 Oct · 8:00 am');
    await expect(home.linkHelp).toHaveText('Visitors can open it now.');
    await expect(home.publish).toBeHidden();
    await expect(home.unpublish).toBeVisible();
    expect(api.events.hubs.of(event.id)?.status).toBe('Published');
    await axe.check();
  });

  // L2-165 AC2: a failed publish says so and Try again publishes.
  test('a failed publish keeps the draft and Try again publishes it', async ({ page, api }) => {
    const { event, grace } = arrange(api);
    const home = new EventHubPage(page);
    await api.signInAs(grace, `/events/${event.id}/hub`);
    api.events.hubs.failNextSave();

    await home.publish.click();

    await expect(home.toast('We couldn’t publish the hub')).toContainText(
      'Check your connection and try again.',
    );
    await expect(home.status).toHaveText('Draft');
    await home.toastAction('We couldn’t publish the hub', 'Try again').click();
    await expect(home.status).toHaveText('Published');
  });

  // L2-164 AC3, L2-165 AC3: Unpublish asks first, then returns the hub to a draft.
  test('unpublishing asks first and returns the hub to a draft', async ({ page, api, axe }) => {
    const { event, grace } = arrange(api);
    api.events.hubs.publish(event.id);
    const home = new EventHubPage(page);
    const dialog = new UnpublishHubDialog(page);
    await api.signInAs(grace, `/events/${event.id}/hub`);

    await home.unpublish.click();
    await expect(dialog.dialog).toContainText(
      'Visitors won’t be able to open it until you publish it again. Everything it says is kept.',
    );
    await axe.check();
    await dialog.cancel.click();
    await expect(dialog.dialog).toBeHidden();
    await expect(home.status).toHaveText('Published');

    await home.unpublish.click();
    await dialog.confirm.click();

    await expect(home.toast('Hub unpublished')).toContainText(
      'It’s a draft again, so only people who manage hubs can open it.',
    );
    await expect(home.status).toHaveText('Draft');
    await expect(home.publishedAt).toBeHidden();
    await expect(home.publish).toBeVisible();
  });

  // L2-165 AC3: a failed unpublish keeps the dialog open with Try again.
  test('a failed unpublish keeps the dialog open and Try again unpublishes', async ({
    page,
    api,
  }) => {
    const { event, grace } = arrange(api);
    api.events.hubs.publish(event.id);
    const home = new EventHubPage(page);
    const dialog = new UnpublishHubDialog(page);
    await api.signInAs(grace, `/events/${event.id}/hub`);
    api.events.hubs.failNextSave();

    await home.unpublish.click();
    await dialog.confirm.click();

    await expect(dialog.failed).toBeVisible();
    await dialog.tryAgain.click();
    await expect(dialog.dialog).toBeHidden();
    await expect(home.status).toHaveText('Draft');
  });
});
