import { expect, test } from '../../../e2e/fixtures/app';
import { CreateEventHubDialog } from '../../../e2e/pages/create-event-hub.dialog';
import { EventHubPage } from '../../../e2e/pages/event-hub.page';
import { EventPage } from '../../../e2e/pages/event.page';
import { Presenter } from '../presenter';

test.use({ timezoneId: 'America/Toronto' });

// Journey: create an event hub (docs/detailed-designs/events/create-event-hub, L2-153, L2-154).
test('create-event-hub', async ({ page, api }) => {
  const show = await Presenter.start(page, 'create-event-hub');
  const eventPage = new EventPage(page);
  const wizard = new CreateEventHubDialog(page);
  const hub = new EventHubPage(page);
  const event = api.events.add({
    title: 'Toronto Builders Night',
    startsAt: '2026-11-06T23:30:00.000Z',
    endsAt: '2026-11-07T02:00:00.000Z',
    visibility: 'Public',
  });
  const grace = api.addAccount({
    email: 'grace@example.org',
    name: 'Grace Okonkwo',
    roles: ['CityLead'],
  });

  await show.card(
    'opening',
    'opening',
    ['Start an event hub', 'Recorded against a local fake API · synthetic people and events'],
    () => api.signInAs(grace, `/events/${event.id}`),
  );

  await show.step('event-page', async () => {
    await expect(eventPage.createEventHub).toBeVisible();
  });

  await show.step('event-step', async () => {
    await eventPage.createEventHub.click();
    await expect(wizard.step).toHaveText(/Step 1 of 4/);
  });

  await show.step('starting-point', async () => {
    await wizard.next.click();
    await expect(wizard.startingPoint('Blank')).toBeChecked();
  });

  await show.step('sections', async () => {
    await wizard.next.click();
    await expect(wizard.sections()).toHaveCount(7);
    await wizard.section('Giving').uncheck();
  });

  await show.step('done', async () => {
    await wizard.next.click();
    await expect(wizard.question).toHaveText('Your hub is ready to fill in');
  });

  await show.step(
    'hub-home',
    async () => {
      await wizard.fillInNow.click();
      await expect(hub.heading).toHaveText('Event hub');
      await expect(page.getByText('3 of 6 sections ready')).toBeVisible();
    },
    { poster: true },
  );

  await show.card('closing', 'closing', [
    'Four short steps, one question each',
    'Saved as a draft as you go',
    'A checklist shows what’s left',
  ]);
  await show.finish();
});
