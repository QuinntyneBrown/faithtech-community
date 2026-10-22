// Traces to: L2-092, L2-093, L2-094, L2-096 (docs/detailed-designs/events/event-check-in)
import { expect, test } from '../../fixtures/app';
import { MockApi } from '../../fixtures/mock-api';
import { EventCheckInPage } from '../../pages/event-check-in.page';
import { BREAKPOINTS, hasHorizontalScroll, undersizedTargets } from '../../pages/viewport';

test.use({ timezoneId: 'America/Toronto' });

/**
 * Toronto Builders Night tonight at 6:30 pm Toronto time; the fake's "now" is 8:00 am, so check-in is
 * open. Ruth RSVP'd first, then Abby as a guest, then Jonah.
 */
function tonight(api: MockApi) {
  const event = api.events.add({
    title: 'Toronto Builders Night',
    startsAt: '2026-10-21T22:30:00.000Z',
    endsAt: '2026-10-22T01:00:00.000Z',
  });
  const ruth = api.addProfile({ name: 'Ruth Alvarez' });
  const jonah = api.addProfile({ name: 'Jonah Bell' });
  api.events.addMember(event, ruth.id, 5);
  api.events.addGuest(event, 'Abby Brooks', 'abby.brooks@example.org', 4);
  api.events.addMember(event, jonah.id, 1);
  return event;
}

function lead(api: MockApi, roles = ['EventLead']) {
  return api.addAccount({ email: 'grace@example.org', name: 'Grace Okonkwo', roles });
}

test.describe('Event check-in', () => {
  // L2-093 AC1: Given an event with RSVPs, when the check-in page loads, then it lists every member and
  // guest who RSVP'd, in RSVP order, with the event's title, date, and counts of going and checked in.
  test('a lead sees every attendee in RSVP order with the attendance meter', async ({
    page,
    api,
    axe,
  }) => {
    const event = tonight(api);
    const checkIn = new EventCheckInPage(page);
    await api.signInAs(lead(api), `/events/${event.id}/check-in`);

    await expect(checkIn.heading).toHaveText('Check-in · Toronto Builders Night');
    await expect(
      page.getByText('Wed 21 Oct · 6:30 pm · Kestrel Labs, 220 King St W'),
    ).toBeVisible();
    await expect(checkIn.meter).toHaveAccessibleName('0 of 3 checked in');
    await expect(checkIn.meterCaption).toHaveText('0 of 3');
    expect(await checkIn.names()).toEqual(['Ruth Alvarez', 'Abby Brooks', 'Jonah Bell']);
    await expect(checkIn.attendee('Ruth Alvarez')).toContainText('Member · Not here yet');
    await expect(checkIn.attendee('Abby Brooks')).toContainText(
      'Guest · abby.brooks@example.org · Not here yet',
    );
    // L2-093 AC6: each switch is labelled "Check in {name}" and announces whether it is on.
    await expect(checkIn.switchFor('Jonah Bell')).not.toBeChecked();
    await axe.check();
    await page.emulateMedia({ colorScheme: 'dark' });
    await axe.check();
  });

  // L2-093 AC2: Given a search term, when the lead types, then the list narrows to attendees whose name or
  // email contains it, case-insensitively, without pressing a button.
  // L2-093 AC3: Given a search with no matches, then it says no one matches.
  test('the search narrows by name or email as the lead types', async ({ page, api, axe }) => {
    const event = tonight(api);
    const checkIn = new EventCheckInPage(page);
    await api.signInAs(lead(api), `/events/${event.id}/check-in`);

    await checkIn.search.fill('JONAH');
    expect(await checkIn.names()).toEqual(['Jonah Bell']);
    await checkIn.search.fill('brooks@example');
    expect(await checkIn.names()).toEqual(['Abby Brooks']);

    await checkIn.search.fill('mira');
    await expect(checkIn.attendees).toHaveCount(0);
    await expect(
      page.getByRole('heading', { name: 'Nobody called “mira” has RSVP’d' }),
    ).toBeVisible();
    await axe.check();
    await checkIn.clearSearch.click();
    await expect(checkIn.search).toHaveValue('');
    await expect(checkIn.attendees).toHaveCount(3);
  });

  // L2-094 AC1: Given a lead, when they turn on an attendee's switch, then the check-in saves at once, the row
  // shows "Checked in {time}", the count rises, and a success toast offers Undo.
  // L2-094 AC2: when the lead chooses Undo or turns the switch off, then the check-in is cleared.
  test('a lead checks an attendee in, then undoes it from the toast and from the switch', async ({
    page,
    api,
    axe,
  }) => {
    const event = tonight(api);
    const checkIn = new EventCheckInPage(page);
    await api.signInAs(lead(api), `/events/${event.id}/check-in`);

    await checkIn.switchFor('Abby Brooks').click();

    await expect(checkIn.switchFor('Abby Brooks')).toBeChecked();
    await expect(checkIn.attendee('Abby Brooks')).toContainText(
      'Guest · abby.brooks@example.org · Checked in 8:00 am',
    );
    await expect(checkIn.meter).toHaveAccessibleName('1 of 3 checked in');
    const toast = checkIn.toast('Abby Brooks is checked in');
    await expect(toast).toContainText('8:00 am · 1 of 3 here.');
    expect(event.rsvps.find((r) => r.guestName === 'Abby Brooks')?.checkedInAt).toBe(
      api.now.toISOString(),
    );
    await axe.check();

    await toast.getByRole('button', { name: 'Undo' }).click();

    await expect(checkIn.switchFor('Abby Brooks')).not.toBeChecked();
    await expect(checkIn.attendee('Abby Brooks')).toContainText('Not here yet');
    await expect(checkIn.meter).toHaveAccessibleName('0 of 3 checked in');
    await expect
      .poll(() => event.rsvps.find((r) => r.guestName === 'Abby Brooks')?.checkedInAt)
      .toBeNull();

    await checkIn.switchFor('Ruth Alvarez').click();
    await expect(checkIn.attendee('Ruth Alvarez')).toContainText('Member · Checked in 8:00 am');
    await checkIn.switchFor('Ruth Alvarez').click();
    await expect(checkIn.attendee('Ruth Alvarez')).toContainText('Member · Not here yet');
    await expect.poll(() => event.rsvps.find((r) => r.profileId)?.checkedInAt).toBeNull();
  });

  // L2-094 AC3: Given a check-in that fails to save, then the switch returns to its previous state and a
  // danger toast says it was not saved.
  test('a failed save turns the switch back and says nothing was saved', async ({
    page,
    api,
    axe,
  }) => {
    const event = tonight(api);
    const checkIn = new EventCheckInPage(page);
    await api.signInAs(lead(api), `/events/${event.id}/check-in`);
    api.events.failNextCheckIn();

    await checkIn.switchFor('Jonah Bell').click();

    const toast = checkIn.toast('Couldn’t save Jonah Bell’s check-in. Try again.');
    await expect(toast).toContainText('The switch is back off; nothing was saved.');
    await expect(checkIn.switchFor('Jonah Bell')).not.toBeChecked();
    await expect(checkIn.attendee('Jonah Bell')).toContainText('Member · Not here yet');
    await expect(checkIn.meter).toHaveAccessibleName('0 of 3 checked in');
    await axe.check();

    await toast.getByRole('button', { name: 'Try again' }).click();
    await expect(checkIn.switchFor('Jonah Bell')).toBeChecked();
    await expect(checkIn.attendee('Jonah Bell')).toContainText('Checked in 8:00 am');
  });

  // L2-093 AC4: Given an event with no RSVPs, when the page loads, then an empty state says no one has
  // RSVP'd yet.
  test('an event without RSVPs says nobody has RSVP’d yet', async ({ page, api, axe }) => {
    const event = api.events.add({ title: 'City Team Prayer & Planning' }, 0.4);
    const checkIn = new EventCheckInPage(page);
    await api.signInAs(lead(api), `/events/${event.id}/check-in`);

    await expect(page.getByRole('heading', { name: 'Nobody has RSVP’d yet' })).toBeVisible();
    await expect(checkIn.meter).toHaveAccessibleName('0 of 0 checked in');
    await axe.check();
  });

  // L2-096 AC4: Given the check-in page is loading, then skeleton rows are shown; when the load fails, then
  // an error offers Try again.
  test('the page shows skeleton rows while loading and Try again when the load fails', async ({
    page,
    api,
    axe,
  }) => {
    const event = tonight(api);
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => (release = resolve));
    let fail = true;
    api.on('GET', `/api/events/${event.id}/check-in`, async (route) => {
      await held;
      return fail ? route.fulfill({ status: 503 }) : api.fallback(route);
    });
    const checkIn = new EventCheckInPage(page);
    await api.signInAs(lead(api), `/events/${event.id}/check-in`);

    await expect(checkIn.loading).toBeVisible();
    await axe.check();
    release();

    await expect(checkIn.loadError).toBeVisible();
    await expect(checkIn.backToEvent).toHaveAttribute('href', `/events/${event.id}`);
    await axe.check();

    fail = false;
    await checkIn.tryAgain.click();
    await expect(checkIn.attendees).toHaveCount(3);
  });

  // L2-093 AC5: Given an XS viewport, then each attendee is one row with a trailing switch of at least 24x24
  // CSS pixels, the search stays at the top, and there is no horizontal page scroll.
  test('the page fits a phone with 24px targets', async ({ page, api }) => {
    await page.setViewportSize(BREAKPOINTS.xs);
    const event = tonight(api);
    const checkIn = new EventCheckInPage(page);
    await api.signInAs(lead(api), `/events/${event.id}/check-in`);

    await expect(checkIn.attendees).toHaveCount(3);
    const search = await checkIn.search.boundingBox();
    const first = await checkIn.attendees.first().boundingBox();
    expect(search!.y).toBeLessThan(first!.y);
    const row = await checkIn.attendee('Abby Brooks').boundingBox();
    const toggle = await checkIn.switchFor('Abby Brooks').boundingBox();
    expect(toggle!.y).toBeGreaterThanOrEqual(row!.y);
    expect(toggle!.y + toggle!.height).toBeLessThanOrEqual(row!.y + row!.height);
    expect(await hasHorizontalScroll(page)).toBe(false);
    expect(await undersizedTargets(page)).toEqual([]);
  });
});
