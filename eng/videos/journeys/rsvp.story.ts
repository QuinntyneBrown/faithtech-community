import { expect, test } from '../../../e2e/fixtures/app';
import { CancelRsvpDialog } from '../../../e2e/pages/cancel-rsvp.dialog';
import { EventPage } from '../../../e2e/pages/event.page';
import { Presenter } from '../presenter';

test.use({ timezoneId: 'America/Toronto' });

// Journey: RSVP to an event (docs/detailed-designs/events/rsvp, L2-022).
test('rsvp', async ({ page, api }) => {
  const show = await Presenter.start(page, 'rsvp');
  const eventPage = new EventPage(page);
  const dialog = new CancelRsvpDialog(page);

  const marcus = api.addProfile({ name: 'Marcus Lee', roles: ['EventLead'] });
  const event = api.events.add({
    title: 'Toronto Builders Night',
    description: 'An evening for Christians who build.',
    startsAt: '2026-11-06T23:30:00.000Z',
    endsAt: '2026-11-07T02:00:00.000Z',
    visibility: 'Public',
    createdById: marcus.id,
  });
  const jonah = api.addProfile({ name: 'Jonah Bell' });
  api.events.addMember(event, jonah.id, 1);
  api.events.addGuest(event, 'Abby Brooks', 'abby.brooks@example.org', 4);
  const leah = api.addAccount({
    email: 'leah@example.org',
    name: 'Leah Thompson',
    roles: ['Attendee'],
  });

  await show.card(
    'opening',
    'opening',
    ['Reserve your place', 'Recorded against a local fake API · synthetic people and events'],
    () => api.signInAs(leah, `/events/${event.id}`),
  );

  await show.step('details', async () => {
    await expect(eventPage.heading).toHaveText('Toronto Builders Night');
    await expect(eventPage.fact('Hosted by')).toHaveText('Marcus Lee, Event Lead');
    await expect(eventPage.fact('Going')).toHaveText('2 people');
  });

  await show.step(
    'rsvp',
    async () => {
      await eventPage.rsvp.click();
      await expect(eventPage.going).toBeVisible();
      await expect(eventPage.fact('Going')).toHaveText('3 people');
      expect(api.events.emails).toContainEqual(expect.objectContaining({ to: 'leah@example.org' }));
    },
    { poster: true },
  );

  await show.step('keep', async () => {
    await eventPage.cancelMyRsvp.click();
    await expect(dialog.dialog).toBeVisible();
    await page.waitForTimeout(2500);
    await dialog.keep.click();
    await expect(dialog.dialog).toHaveCount(0);
    await expect(eventPage.going).toBeVisible();
  });

  await show.step('cancel', async () => {
    await eventPage.cancelMyRsvp.click();
    await dialog.confirm.click();
    await expect(dialog.dialog).toHaveCount(0);
    await expect(page.getByText('Your RSVP is cancelled')).toBeVisible();
    await expect(eventPage.rsvp).toBeVisible();
  });

  await show.step('again', async () => {
    await eventPage.rsvp.click();
    await expect(eventPage.going).toBeVisible();
  });

  await show.card('closing', 'closing', [
    'One press to RSVP',
    'Confirmation by email with a calendar file',
    'Cancel any time, after confirming',
  ]);
  await show.finish();
});
