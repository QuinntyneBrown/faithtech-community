import { expect, test } from '../../../e2e/fixtures/app';
import { CreateEventHubDialog } from '../../../e2e/pages/create-event-hub.dialog';
import { EventHubPage } from '../../../e2e/pages/event-hub.page';
import { EventPage } from '../../../e2e/pages/event.page';
import { Presenter } from '../presenter';

test.use({ timezoneId: 'America/Toronto' });

// Journey: start a hub from a template (docs/detailed-designs/events/start-hub-from-template, L2-169 to L2-171).
test('start-hub-from-template', async ({ page, api }) => {
  const show = await Presenter.start(page, 'start-hub-from-template');
  const eventPage = new EventPage(page);
  const wizard = new CreateEventHubDialog(page);
  const home = new EventHubPage(page);
  const night = api.events.add({
    title: 'Toronto Builders Night',
    startsAt: '2026-11-06T23:30:00.000Z',
    endsAt: '2026-11-07T02:00:00.000Z',
    venue: 'Kestrel Labs, 220 King St W, Toronto',
    visibility: 'Public',
  });
  const socal = api.events.add({
    title: 'SoCal Hackathon',
    startsAt: '2026-10-24T16:00:00.000Z',
    endsAt: '2026-10-25T01:00:00.000Z',
  });
  api.events.hubs.add(socal, ['Giving']);
  api.events.hubs.fill(socal.id, 'Hero', { subtitle: 'Build for the shelters of Los Angeles' });
  api.events.hubs.fill(socal.id, 'Agenda', {
    items: [
      { startsAt: '2026-10-24T16:00:00.000Z', title: 'Check-in and breakfast', detail: null },
      { startsAt: '2026-10-24T17:00:00.000Z', title: 'Kickoff', detail: null },
      { startsAt: '2026-10-25T00:00:00.000Z', title: 'Code freeze', detail: null },
    ],
  });
  const winter = api.events.add({
    title: 'Winter Hackathon',
    startsAt: '2026-12-05T15:00:00.000Z',
    endsAt: '2026-12-06T00:00:00.000Z',
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
      'Start a hub from a template',
      'Recorded against a local fake API · synthetic people and events',
    ],
    () => api.signInAs(grace, `/events/${night.id}`),
  );

  await show.step(
    'choices',
    async () => {
      await eventPage.createEventHub.click();
      await wizard.next.click();
      await expect(wizard.startingPoints()).toHaveCount(5);
    },
    { poster: true },
  );

  await show.step('meetup', async () => {
    await wizard.startingPoint('Meetup').check();
  });

  await show.step('ticked', async () => {
    await wizard.next.click();
    await expect(wizard.step).toHaveText(/Step 3 of 4\s*Sections/);
  });

  await show.step('filled', async () => {
    await wizard.next.click();
    await wizard.fillInNow.click();
    await expect(home.heading).toHaveText('Event hub');
  });

  await show.step('copy', async () => {
    await eventPage.open(winter.id);
    await eventPage.createEventHub.click();
    await wizard.next.click();
    await wizard.startingPoint('Copy a past hub').check();
    await expect(wizard.pastHubs().first()).toBeVisible();
    await wizard.searchPastHubs.pressSequentially('hack', { delay: 120 });
    await expect(wizard.pastHubs()).toHaveCount(1);
  });

  await show.step('pick', async () => {
    await wizard.pastHub('SoCal Hackathon').check();
  });

  await show.step('copied', async () => {
    await wizard.next.click();
    await expect(wizard.section('Giving')).not.toBeChecked();
    await wizard.next.click();
    await wizard.fillInNow.click();
    await expect(home.heading).toHaveText('Event hub');
  });

  await show.card('closing', 'closing', [
    'Templates fill in the usual',
    'Copy a past hub, times moved',
    'Every choice can be changed later',
  ]);
  await show.finish();
});
