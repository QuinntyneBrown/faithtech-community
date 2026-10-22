import { expect, test } from '../../../e2e/fixtures/app';
import { GuestCancelRsvpPage } from '../../../e2e/pages/guest-cancel-rsvp.page';
import { PublicEventPage } from '../../../e2e/pages/public-event.page';
import { Presenter, typeInto } from '../presenter';

test.use({ timezoneId: 'America/Toronto' });

// Journey: public events and guest RSVP (docs/detailed-designs/events/public-events-and-guest-rsvp, L2-023).
test('public-events-and-guest-rsvp', async ({ page, api }) => {
  const show = await Presenter.start(page, 'public-events-and-guest-rsvp');
  const publicPage = new PublicEventPage(page);
  const cancelPage = new GuestCancelRsvpPage(page);

  const event = api.events.add({
    title: 'Toronto Builders Night',
    description: 'An evening for Christians who build.',
    startsAt: '2026-11-06T23:30:00.000Z',
    endsAt: '2026-11-07T02:00:00.000Z',
    visibility: 'Public',
  });
  api.events.addRsvps(event, 34);

  await show.card('opening', 'opening', [
    'RSVP without an account',
    'Recorded against a local fake API · synthetic people and events',
  ]);

  await show.step('public-page', async () => {
    await publicPage.open(event.id);
    await expect(publicPage.heading).toHaveText('Toronto Builders Night');
    await expect(page.getByText('No account needed. 34 people are going.')).toBeVisible();
  });

  await show.step('validation', async () => {
    await publicPage.rsvp('', 'abby.brooks@');
    await expect(publicPage.summary).toContainText('Fix 2 things to RSVP');
  });

  await show.step(
    'rsvp',
    async () => {
      await typeInto(publicPage.name, 'Abby Brooks');
      await typeInto(publicPage.email, 'abby.brooks@example.org');
      await publicPage.imGoing.click();
      await expect(publicPage.onTheList).toHaveText('You’re on the list, Abby');
    },
    { poster: true },
  );

  await show.step('cancel-link', async () => {
    await cancelPage.follow(api.events.cancelLinkFor('abby.brooks@example.org'));
    await expect(cancelPage.question).toBeVisible();
  });

  await show.step('cancelled', async () => {
    await cancelPage.cancel.click();
    await expect(cancelPage.cancelled).toBeVisible();
  });

  await show.card('closing', 'closing', [
    'Public events can be shared with anyone',
    'Guests RSVP with a name and an email',
    'A cancel link in every confirmation',
  ]);
  await show.finish();
});
