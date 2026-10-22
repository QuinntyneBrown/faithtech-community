// Traces to: L2-022, L2-020 AC5 (docs/detailed-designs/events/rsvp)
import { expect, test } from '../../fixtures/app';
import { MockApi } from '../../fixtures/mock-api';
import { CancelRsvpDialog } from '../../pages/cancel-rsvp.dialog';
import { EventPage } from '../../pages/event.page';

test.use({ timezoneId: 'America/Toronto' });

function addEvent(api: MockApi) {
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
  return event;
}

test.describe('RSVP', () => {
  test('a member RSVPs, is confirmed in-app and by email with the .ics, and sees only the count', async ({
    page,
    api,
    axe,
  }) => {
    const event = addEvent(api);
    const leah = api.addAccount({
      email: 'leah@example.org',
      name: 'Leah Thompson',
      roles: ['Attendee'],
    });
    const eventPage = new EventPage(page);
    await api.signInAs(leah, `/events/${event.id}`);

    await expect(eventPage.heading).toHaveText('Toronto Builders Night');
    await expect(page.getByText('Fri 6 Nov 2026 · 6:30 – 9:00 pm')).toBeVisible();
    await expect(eventPage.fact('Hosted by')).toHaveText('Marcus Lee, Event Lead');
    await expect(eventPage.fact('Going')).toHaveText('2 people');
    await expect(eventPage.rsvpListHeading).toHaveCount(0);
    await expect(eventPage.edit).toHaveCount(0);
    await axe.check();

    await eventPage.rsvp.click();

    await expect(eventPage.going).toBeVisible();
    await expect(eventPage.fact('Going')).toHaveText('3 people');
    await expect(eventPage.rsvp).toHaveCount(0);
    expect(api.events.notifications).toContainEqual(
      expect.objectContaining({ recipientId: leah.profileId, kind: 'RsvpConfirmed' }),
    );
    expect(api.events.emails).toContainEqual(
      expect.objectContaining({
        to: 'leah@example.org',
        attachment: { fileName: 'toronto-builders-night.ics', contentType: 'text/calendar' },
      }),
    );
    await axe.check();
    await page.emulateMedia({ colorScheme: 'dark' });
    await axe.check();
  });

  test('a member cancels their RSVP after confirming and can RSVP again', async ({
    page,
    api,
    axe,
  }) => {
    const event = addEvent(api);
    const leah = api.addAccount({ email: 'leah@example.org', roles: ['Attendee'] });
    api.events.addMember(event, leah.profileId);
    const eventPage = new EventPage(page);
    const dialog = new CancelRsvpDialog(page);
    await api.signInAs(leah, `/events/${event.id}`);

    await eventPage.cancelMyRsvp.click();
    await expect(dialog.dialog).toContainText(
      'Marcus will see one fewer person coming. You can RSVP again any time before the event.',
    );
    await expect(dialog.keep).toBeFocused();
    await axe.check();
    await dialog.keep.click();
    await expect(dialog.dialog).toHaveCount(0);
    await expect(eventPage.going).toBeVisible();

    await eventPage.cancelMyRsvp.click();
    await dialog.confirm.click();

    await expect(dialog.dialog).toHaveCount(0);
    await expect(page.getByText('Your RSVP is cancelled')).toBeVisible();
    await expect(eventPage.rsvp).toBeVisible();
    expect(event.rsvps.some((r) => r.profileId === leah.profileId)).toBe(false);

    await eventPage.rsvp.click();
    await expect(eventPage.going).toBeVisible();
  });

  test('a failed cancellation keeps the RSVP and says nothing changed', async ({ page, api }) => {
    const event = addEvent(api);
    const leah = api.addAccount({ email: 'leah@example.org', roles: ['Attendee'] });
    api.events.addMember(event, leah.profileId);
    api.on('DELETE', `/api/events/${event.id}/rsvps/me`, (route) => route.abort('failed'));
    const eventPage = new EventPage(page);
    const dialog = new CancelRsvpDialog(page);
    await api.signInAs(leah, `/events/${event.id}`);

    await eventPage.cancelMyRsvp.click();
    await dialog.confirm.click();

    await expect(dialog.failed).toBeVisible();
    expect(event.rsvps.some((r) => r.profileId === leah.profileId)).toBe(true);
  });

  test('an event at capacity refuses the RSVP as full', async ({ page, api }) => {
    const event = addEvent(api);
    event.capacity = 3;
    const leah = api.addAccount({ email: 'leah@example.org', roles: ['Attendee'] });
    const eventPage = new EventPage(page);
    await api.signInAs(leah, `/events/${event.id}`);

    // Someone else takes the last place while the page is open.
    await expect(eventPage.rsvp).toBeVisible();
    api.events.addRsvps(event, 1);
    await eventPage.rsvp.click();

    await expect(eventPage.refused).toContainText('This event is full.');
    await expect(eventPage.rsvp).toHaveCount(0);

    await eventPage.open(event.id);
    await expect(eventPage.full).toBeVisible();
    await expect(eventPage.rsvp).toHaveCount(0);
  });

  test('a lead sees the full list with guest emails and exports it as CSV', async ({
    page,
    api,
    axe,
  }) => {
    const event = addEvent(api);
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const eventPage = new EventPage(page);
    await api.signInAs(grace, `/events/${event.id}`);

    await expect(eventPage.rsvpListHeading).toHaveText('Going (2)');
    await expect(eventPage.attendee('Jonah Bell')).toContainText('Member · RSVP’d Tue 20 Oct');
    await expect(eventPage.attendee('Abby Brooks')).toContainText(
      'Guest · abby.brooks@example.org · RSVP’d Sat 17 Oct',
    );
    await expect(eventPage.edit).toHaveAttribute('href', `/events/${event.id}/edit`);
    await axe.check();

    const download = page.waitForEvent('download');
    await eventPage.exportCsv.click();
    expect((await download).suggestedFilename()).toBe('toronto-builders-night-rsvps.csv');
    await expect(page.getByText('RSVP list exported')).toBeVisible();
  });

  test('Staff see the list without guest emails or Export CSV', async ({ page, api }) => {
    const event = addEvent(api);
    const sam = api.addAccount({ email: 'sam@example.org', roles: ['Staff'] });
    const eventPage = new EventPage(page);
    await api.signInAs(sam, `/events/${event.id}`);

    await expect(eventPage.attendee('Abby Brooks')).toContainText('Guest · RSVP’d Sat 17 Oct');
    await expect(eventPage.attendee('Abby Brooks')).not.toContainText('abby.brooks@example.org');
    await expect(eventPage.exportCsv).toHaveCount(0);
  });

  test('the event page shows an error with Try again when it cannot load', async ({
    page,
    api,
    axe,
  }) => {
    const event = addEvent(api);
    const leah = api.addAccount({ email: 'leah@example.org', roles: ['Attendee'] });
    let fail = true;
    api.on('GET', `/api/events/${event.id}`, (route) =>
      fail ? route.fulfill({ status: 503 }) : api.fallback(route),
    );
    const eventPage = new EventPage(page);
    await api.signInAs(leah, `/events/${event.id}`);

    await expect(eventPage.loadError).toBeVisible();
    await axe.check();
    fail = false;
    await eventPage.tryAgain.click();
    await expect(eventPage.heading).toHaveText('Toronto Builders Night');
  });
});
