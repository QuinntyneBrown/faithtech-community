import { expect, test } from '../../../e2e/fixtures/app';
import { EventFormPage } from '../../../e2e/pages/event-form.page';
import { EventPage } from '../../../e2e/pages/event.page';
import { EventsPage } from '../../../e2e/pages/events.page';
import { Presenter, typeInto } from '../presenter';

test.use({ timezoneId: 'America/Toronto' });

// Journey: create and edit events (docs/detailed-designs/events/create-and-edit-events, L2-020).
test('create-and-edit-events', async ({ page, api }) => {
  const show = await Presenter.start(page, 'create-and-edit-events');
  const events = new EventsPage(page);
  const form = new EventFormPage(page);
  const eventPage = new EventPage(page);
  const grace = api.addAccount({
    email: 'grace@example.org',
    name: 'Grace Okafor',
    roles: ['EventLead'],
  });

  await show.card(
    'opening',
    'opening',
    [
      'Publish an event, then change it',
      'Recorded against a local fake API · synthetic people and events',
    ],
    () => api.signInAs(grace, '/events'),
  );

  await show.step('new-event', async () => {
    await expect(events.newEvent).toBeVisible();
    await events.newEvent.click();
    await expect(form.heading).toHaveText('New event');
  });

  await show.step('errors', async () => {
    await form.publish.click();
    await expect(form.summary).toBeVisible();
  });

  await show.step(
    'details',
    async () => {
      await typeInto(form.title, 'Toronto Builders Night');
      await form.fill({
        type: 'Builders night',
        description: 'An evening for Christians who build.',
        starts: '2026-11-06T18:30',
        ends: '2026-11-06T21:00',
        format: 'In person',
        city: 'Toronto',
        venue: 'Kestrel Labs, 220 King St W',
        visibility: 'Members only',
        capacity: '60',
      });
      await form.publish.click();
      await expect(page).toHaveURL(/\/events\/event-1$/);
    },
    { poster: true },
  );

  await show.step('saved', async () => {
    await expect(eventPage.heading).toHaveText('Toronto Builders Night');
    api.events.addRsvps(api.events.events[0], 2);
  });

  await show.step('edit', async () => {
    await eventPage.edit.click();
    await expect(form.heading).toHaveText('Edit event');
    await typeInto(form.venue, 'Trinity Community Centre');
    await form.saveChanges.click();
    await expect(eventPage.heading).toHaveText('Toronto Builders Night');
  });

  await show.card('closing', 'closing', [
    'Only event leads can create and edit',
    'Clear errors before anything is saved',
    'Attendees are told about changes',
  ]);
  await show.finish();
});
