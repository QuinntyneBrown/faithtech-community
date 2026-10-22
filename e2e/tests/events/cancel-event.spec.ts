// Traces to: L2-025 (docs/detailed-designs/events/cancel-events)
import { expect, test } from '../../fixtures/app';
import { MockApi } from '../../fixtures/mock-api';
import { CancelEventDialog } from '../../pages/cancel-event.dialog';
import { EventPage } from '../../pages/event.page';
import { PublicEventPage } from '../../pages/public-event.page';

test.use({ timezoneId: 'America/Toronto' });

const REASON = 'Our venue fell through. We’ll reschedule for January — watch your inbox.';

function addEvent(api: MockApi) {
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
  return { event, ruth, jonah };
}

test.describe('Cancel events', () => {
  test('a City Lead cancels with a reason; RSVPs are refused and everyone who RSVP’d is told', async ({
    page,
    api,
    axe,
  }) => {
    const { event, ruth, jonah } = addEvent(api);
    const esther = api.addAccount({
      email: 'esther@example.org',
      name: 'Esther Nakamura',
      roles: ['CityLead'],
    });
    const eventPage = new EventPage(page);
    const dialog = new CancelEventDialog(page);
    await api.signInAs(esther, `/events/${event.id}`);

    await eventPage.cancelEvent.click();
    await expect(dialog.dialog).toContainText('Cancel Toronto Builders Night?');
    await expect(dialog.dialog).toContainText(
      'All 3 people who RSVP’d get an email; the 2 members also get an in-app notification.',
    );
    await expect(dialog.message).toBeFocused();
    await axe.check();

    await dialog.message.fill(REASON);
    await dialog.confirm.click();

    await expect(dialog.dialog).toHaveCount(0);
    await expect(page.getByText('Event cancelled')).toBeVisible();
    await expect(eventPage.cancellation).toContainText(
      `Esther Nakamura cancelled it on Wed 21 Oct: “${REASON}” Everyone who RSVP’d was emailed.`,
    );
    await expect(eventPage.cancelEvent).toHaveCount(0);
    await expect(eventPage.edit).toHaveCount(0);
    await expect(eventPage.rsvp).toHaveCount(0);
    expect(event).toMatchObject({ isCancelled: true, cancellationReason: REASON, sequence: 1 });
    expect(api.events.notifications.map((n) => [n.recipientId, n.kind])).toEqual([
      [ruth.id, 'EventCancelled'],
      [jonah.id, 'EventCancelled'],
    ]);
    expect(api.events.emails.map((m) => m.to)).toEqual([
      `profile:${ruth.id}`,
      `profile:${jonah.id}`,
      'abby.brooks@example.org',
    ]);
    await axe.check();

    const publicPage = new PublicEventPage(page);
    await publicPage.open(event.id);
    await expect(publicPage.cancelled).toBeVisible();
    await expect(publicPage.imGoing).toHaveCount(0);
  });

  test('an empty reason asks the lead to tell attendees why', async ({ page, api, axe }) => {
    const { event } = addEvent(api);
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['EventLead'] });
    const eventPage = new EventPage(page);
    const dialog = new CancelEventDialog(page);
    await api.signInAs(grace, `/events/${event.id}`);

    await eventPage.cancelEvent.click();
    await dialog.confirm.click();

    expect(await dialog.error()).toContain('Tell attendees why, so they aren’t left guessing.');
    await expect(dialog.message).toHaveAttribute('aria-invalid', 'true');
    expect(api.callsTo('POST', `/api/events/${event.id}/cancel`)).toHaveLength(0);
    expect(event.isCancelled).toBe(false);
    await axe.check();

    await dialog.keep.click();
    await expect(dialog.dialog).toHaveCount(0);
    expect(event.isCancelled).toBe(false);
  });

  test('a failed cancellation changes nothing and says so', async ({ page, api }) => {
    const { event } = addEvent(api);
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['EventLead'] });
    api.on('POST', `/api/events/${event.id}/cancel`, (route) => route.abort('failed'));
    const eventPage = new EventPage(page);
    const dialog = new CancelEventDialog(page);
    await api.signInAs(grace, `/events/${event.id}`);

    await eventPage.cancelEvent.click();
    await dialog.message.fill(REASON);
    await dialog.confirm.click();

    await expect(dialog.failed).toBeVisible();
    await expect(dialog.message).toHaveValue(REASON);
    expect(event.isCancelled).toBe(false);
  });

  test('members without an event role see no Cancel event', async ({ page, api }) => {
    const { event } = addEvent(api);
    const sam = api.addAccount({ email: 'sam@example.org', roles: ['Staff'] });
    const eventPage = new EventPage(page);
    await api.signInAs(sam, `/events/${event.id}`);

    await expect(eventPage.heading).toHaveText('Toronto Builders Night');
    await expect(eventPage.cancelEvent).toHaveCount(0);
  });
});
