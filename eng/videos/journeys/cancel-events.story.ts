import { expect, test } from '../../../e2e/fixtures/app';
import { CancelEventDialog } from '../../../e2e/pages/cancel-event.dialog';
import { EventPage } from '../../../e2e/pages/event.page';
import { PublicEventPage } from '../../../e2e/pages/public-event.page';
import { Presenter, typeInto } from '../presenter';

test.use({ timezoneId: 'America/Toronto' });

const REASON = 'Our venue fell through. We’ll reschedule for January — watch your inbox.';

// Journey: cancel an event (docs/detailed-designs/events/cancel-events, L2-025).
test('cancel-events', async ({ page, api }) => {
  const show = await Presenter.start(page, 'cancel-events');
  const eventPage = new EventPage(page);
  const dialog = new CancelEventDialog(page);

  const event = api.events.add({
    title: 'Toronto Builders Night',
    startsAt: '2026-11-06T23:30:00.000Z',
    endsAt: '2026-11-07T02:00:00.000Z',
    visibility: 'Public',
  });
  const ruth = api.addProfile({ name: 'Ruth Alvarez' });
  const jonah = api.addProfile({ name: 'Jonah Bell' });
  api.events.addMember(event, ruth.id);
  api.events.addMember(event, jonah.id);
  api.events.addGuest(event, 'Abby Brooks', 'abby.brooks@example.org');
  const esther = api.addAccount({
    email: 'esther@example.org',
    name: 'Esther Nakamura',
    roles: ['CityLead'],
  });

  await show.card(
    'opening',
    'opening',
    [
      'Cancel an event and tell everyone why',
      'Recorded against a local fake API · synthetic people and events',
    ],
    () => api.signInAs(esther, `/events/${event.id}`),
  );

  await show.step('dialog', async () => {
    await eventPage.cancelEvent.click();
    await expect(dialog.dialog).toContainText('Cancel Toronto Builders Night?');
    await expect(dialog.dialog).toContainText('All 3 people who RSVP’d get an email');
  });

  await show.step('empty-reason', async () => {
    await dialog.confirm.click();
    await expect.poll(() => dialog.error()).toContain('Tell attendees why');
  });

  await show.step('reason', async () => {
    await typeInto(dialog.message, REASON);
    await dialog.confirm.click();
    await expect(dialog.dialog).toHaveCount(0);
  });

  await show.step(
    'cancelled',
    async () => {
      await expect(eventPage.cancellation).toContainText('Esther Nakamura cancelled it');
      await expect(eventPage.cancelEvent).toHaveCount(0);
    },
    { poster: true },
  );

  await show.step('public', async () => {
    const publicPage = new PublicEventPage(page);
    await publicPage.open(event.id);
    await expect(publicPage.cancelled).toBeVisible();
    await expect(publicPage.imGoing).toHaveCount(0);
  });

  await show.card('closing', 'closing', [
    'A reason is required',
    'Everyone who RSVPed is told',
    'No more RSVPs',
  ]);
  await show.finish();
});
