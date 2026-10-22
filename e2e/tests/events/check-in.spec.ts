// Traces to: L2-117, L2-118, L2-119, L2-121 (docs/detailed-designs/events/event-check-in)
import { expect, test } from '../../fixtures/app';
import { MockApi } from '../../fixtures/mock-api';
import { EventCheckInPage } from '../../pages/event-check-in.page';
import { EventPage } from '../../pages/event.page';
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
  // L2-118 AC1: Given an event with RSVPs, when the check-in page loads, then it lists every member and
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
    // L2-118 AC6: each switch is labelled "Check in {name}" and announces whether it is on.
    await expect(checkIn.switchFor('Jonah Bell')).not.toBeChecked();
    await axe.check();
    await page.emulateMedia({ colorScheme: 'dark' });
    await axe.check();
  });

  // L2-118 AC2: Given a search term, when the lead types, then the list narrows to attendees whose name or
  // email contains it, case-insensitively, without pressing a button.
  // L2-118 AC3: Given a search with no matches, then it says no one matches.
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

  // L2-119 AC1: Given a lead, when they turn on an attendee's switch, then the check-in saves at once, the row
  // shows "Checked in {time}", the count rises, and a success toast offers Undo.
  // L2-119 AC2: when the lead chooses Undo or turns the switch off, then the check-in is cleared.
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

  // L2-119 AC3: Given a check-in that fails to save, then the switch returns to its previous state and a
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

  // L2-118 AC4: Given an event with no RSVPs, when the page loads, then an empty state says no one has
  // RSVP'd yet.
  test('an event without RSVPs says nobody has RSVP’d yet', async ({ page, api, axe }) => {
    const event = api.events.add({ title: 'City Team Prayer & Planning' }, 0.4);
    const checkIn = new EventCheckInPage(page);
    await api.signInAs(lead(api), `/events/${event.id}/check-in`);

    await expect(page.getByRole('heading', { name: 'Nobody has RSVP’d yet' })).toBeVisible();
    await expect(checkIn.meter).toHaveAccessibleName('0 of 0 checked in');
    await axe.check();
  });

  // L2-121 AC4: Given the check-in page is loading, then skeleton rows are shown; when the load fails, then
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

  // L2-118 AC5: Given an XS viewport, then each attendee is one row with a trailing switch of at least 24x24
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

test.describe('Event check-in access and states', () => {
  // L2-117 AC2: Given Staff, when they open the check-in page, then they see the attendees and counts
  // read-only: switches disabled, no Add walk-in or Export CSV, no guest emails. L2-118 AC2: Staff match on name.
  test('Staff see the list read-only without guest emails', async ({ page, api, axe }) => {
    const event = tonight(api);
    const sam = api.addAccount({ email: 'sam@example.org', roles: ['Staff'] });
    const checkIn = new EventCheckInPage(page);
    await api.signInAs(sam, `/events/${event.id}/check-in`);

    await expect(checkIn.readOnly).toContainText(
      'You can see who’s here. Leads check people in, add walk-ins and export the list, which carries guest emails.',
    );
    await expect(checkIn.attendee('Abby Brooks')).toContainText('Guest · Not here yet');
    await expect(page.getByText('abby.brooks@example.org')).toHaveCount(0);
    for (const toggle of await checkIn.switches.all()) await expect(toggle).toBeDisabled();
    await expect(checkIn.addWalkIn).toHaveCount(0);
    await expect(checkIn.exportCsv).toHaveCount(0);
    await expect(checkIn.search).toHaveAttribute('placeholder', 'Find by name');
    await checkIn.search.fill('brooks@example');
    await expect(checkIn.attendees).toHaveCount(0);
    await expect(checkIn.emptyAction(/as a walk-in/)).toHaveCount(0);
    await checkIn.search.fill('');
    await axe.check();
  });

  // L2-117 AC3: Given a signed-in member without a lead role, Staff or System Admin, when they open the
  // check-in page, then the forbidden page is shown.
  test('a member without a lead role sees that check-in is for event leads', async ({
    page,
    api,
    axe,
  }) => {
    const event = tonight(api);
    const leah = api.addAccount({ email: 'leah@example.org', roles: ['Attendee'] });
    const checkIn = new EventCheckInPage(page);
    await api.signInAs(leah, `/events/${event.id}/check-in`);

    await expect(checkIn.forbidden).toBeVisible();
    await expect(checkIn.heading).toHaveText('Check-in');
    await expect(checkIn.backToEvent).toHaveAttribute('href', `/events/${event.id}`);
    await axe.check();
  });

  test('an unknown event says it can’t be found', async ({ page, api, axe }) => {
    const checkIn = new EventCheckInPage(page);
    await api.signInAs(lead(api), '/events/event-404/check-in');

    await expect(page.getByRole('heading', { name: 'We couldn’t find that event' })).toBeVisible();
    await expect(checkIn.heading).toHaveText('Check-in');
    await axe.check();
  });

  // L2-117 AC4: Given an anonymous visitor, when they open the check-in page, then they are sent to sign in.
  test('an anonymous visitor is sent to sign in', async ({ page, api }) => {
    const event = tonight(api);
    const checkIn = new EventCheckInPage(page);

    await checkIn.open(event.id);

    await expect(page).toHaveURL(
      `/sign-in?returnUrl=${encodeURIComponent(`/events/${event.id}/check-in`)}`,
    );
  });

  // L2-117 AC1: a System Admin without a lead role checks attendees in too (the server audits it).
  test('a System Admin checks an attendee in', async ({ page, api }) => {
    const event = tonight(api);
    const priya = api.addAccount({ email: 'priya@example.org', roles: ['SystemAdmin'] });
    const checkIn = new EventCheckInPage(page);
    await api.signInAs(priya, `/events/${event.id}/check-in`);

    await checkIn.switchFor('Ruth Alvarez').click();

    await expect(checkIn.attendee('Ruth Alvarez')).toContainText('Checked in 8:00 am');
  });

  // L2-119 AC5: Given a cancelled event, when a lead opens its check-in page, then it says the event is
  // cancelled and the switches are disabled.
  test('a cancelled event says no one can be checked in', async ({ page, api, axe }) => {
    const event = tonight(api);
    event.isCancelled = true;
    event.cancellationReason = 'The venue flooded.';
    const checkIn = new EventCheckInPage(page);
    await api.signInAs(lead(api), `/events/${event.id}/check-in`);

    await expect(checkIn.cancelled).toContainText('The RSVP list stays here for reference.');
    await expect(checkIn.openEvent).toHaveAttribute('href', `/events/${event.id}`);
    await expect(page.locator('ft-page-header').getByText('Cancelled')).toBeVisible();
    for (const toggle of await checkIn.switches.all()) await expect(toggle).toBeDisabled();
    await expect(checkIn.addWalkIn).toHaveCount(0);
    await axe.check();
  });

  // L2-119 AC6: Given an event that starts more than 24 hours from now, then the switches are disabled and
  // the page says when check-in opens.
  test('check-in has not opened until 24 hours before the start', async ({ page, api, axe }) => {
    const event = tonight(api);
    event.startsAt = '2026-10-22T22:30:00.000Z';
    event.endsAt = '2026-10-23T01:00:00.000Z';
    const checkIn = new EventCheckInPage(page);
    await api.signInAs(lead(api), `/events/${event.id}/check-in`);

    await expect(checkIn.notOpen).toHaveText(
      'Check-in opens Wed 21 Oct at 6:30 pm, 24 hours before the event.',
    );
    for (const toggle of await checkIn.switches.all()) await expect(toggle).toBeDisabled();
    await expect(checkIn.addWalkIn).toBeDisabled();
    await axe.check();
  });

  // L2-119 AC7: Given every attendee is checked in, when the list renders, then it shows "Everyone's here",
  // without promising any follow-up email.
  test('everyone checked in shows Everyone’s here', async ({ page, api, axe }) => {
    const event = tonight(api);
    for (const rsvp of event.rsvps.slice(0, 2)) rsvp.checkedInAt = api.now.toISOString();
    const checkIn = new EventCheckInPage(page);
    await api.signInAs(lead(api), `/events/${event.id}/check-in`);
    await expect(checkIn.everyonesHere).toHaveCount(0);

    await checkIn.switchFor('Jonah Bell').click();

    await expect(checkIn.everyonesHere).toContainText('All 3 who RSVP’d are checked in.');
    await expect(checkIn.everyonesHere).not.toContainText('email');
    await expect(checkIn.meter).toHaveAccessibleName('3 of 3 checked in');
    await axe.check();
  });

  // L2-121 AC1, AC2: the event page shows "{n} checked in" to leads, Staff and System Admins once anyone is
  // checked in, and L2-117 AC1 offers leads Check in; Staff get View check-in; members get neither.
  test('the event page shows attendance and the way into check-in', async ({ page, api }) => {
    const event = tonight(api);
    const eventPage = new EventPage(page);
    const grace = lead(api);
    await api.signInAs(grace, `/events/${event.id}`);

    await expect(eventPage.fact('Going')).toHaveText('3 people');
    await expect(eventPage.checkIn).toHaveAttribute('href', `/events/${event.id}/check-in`);
    await expect(eventPage.viewCheckIn).toHaveCount(0);

    event.rsvps[0].checkedInAt = api.now.toISOString();
    await eventPage.open(event.id);
    await expect(eventPage.fact('Going')).toHaveText('3 people · 1 checked in');
    await expect(eventPage.rsvpListHeading).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Going (3) · 1 checked in' })).toBeVisible();
    await expect(eventPage.attendee('Ruth Alvarez')).toContainText('Member · Checked in 8:00 am');
  });

  test('Staff get View check-in', async ({ page, api }) => {
    const event = tonight(api);
    event.rsvps[0].checkedInAt = api.now.toISOString();
    const eventPage = new EventPage(page);
    const sam = api.addAccount({ email: 'sam@example.org', roles: ['Staff'] });
    await api.signInAs(sam, `/events/${event.id}`);

    await expect(eventPage.viewCheckIn).toHaveAttribute('href', `/events/${event.id}/check-in`);
    await expect(eventPage.checkIn).toHaveCount(0);
    await expect(eventPage.fact('Going')).toHaveText('3 people · 1 checked in');
  });

  test('members see no attendance and no way into check-in', async ({ page, api }) => {
    const event = tonight(api);
    event.rsvps[0].checkedInAt = api.now.toISOString();
    const eventPage = new EventPage(page);
    const leah = api.addAccount({ email: 'leah@example.org', roles: ['Attendee'] });
    await api.signInAs(leah, `/events/${event.id}`);

    await expect(eventPage.fact('Going')).toHaveText('3 people');
    await expect(eventPage.checkIn).toHaveCount(0);
    await expect(eventPage.viewCheckIn).toHaveCount(0);
  });
});

test.describe('Export attendance', () => {
  // L2-122 AC1: Given a lead on the check-in page, when they choose Export CSV, then the attendance downloads
  // with one row per attendee. L2-122 AC4: while it is prepared, Export CSV is busy and cannot be pressed again.
  test('a lead exports the attendance as CSV', async ({ page, api, axe }) => {
    const event = tonight(api);
    event.rsvps[0].checkedInAt = api.now.toISOString();
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => (release = resolve));
    api.on('GET', `/api/events/${event.id}/check-ins.csv`, async (route) => {
      await held;
      return api.fallback(route);
    });
    const checkIn = new EventCheckInPage(page);
    await api.signInAs(lead(api), `/events/${event.id}/check-in`);

    const download = page.waitForEvent('download');
    await checkIn.exportCsv.click();
    await expect(checkIn.exportCsv).toHaveText('Exporting…');
    await expect(checkIn.exportCsv).toHaveAttribute('aria-busy', 'true');
    await axe.check();
    release();

    expect((await download).suggestedFilename()).toBe('toronto-builders-night-attendance.csv');
    await expect(checkIn.toast('Attendance exported')).toContainText(
      'toronto-builders-night-attendance.csv is in your downloads.',
    );
    expect(api.callsTo('GET', `/api/events/${event.id}/check-ins.csv`)).toHaveLength(1);
    const lines = api.events.attendanceCsv(event.id).trimEnd().split('\r\n');
    expect(lines[0]).toBe('"Name","Type","Email","RSVP\'d (UTC)","Checked in (UTC)"');
    expect(lines[1]).toBe('"Ruth Alvarez","Member","","2026-10-16 12:00","2026-10-21 12:00"');
    expect(lines[2]).toBe('"Abby Brooks","Guest","abby.brooks@example.org","2026-10-17 12:00",""');
  });

  // L2-122 AC4: when the export fails, a danger toast offers Try again.
  test('a failed export offers Try again', async ({ page, api, axe }) => {
    const event = tonight(api);
    let fail = true;
    api.on('GET', `/api/events/${event.id}/check-ins.csv`, (route) =>
      fail ? route.abort('failed') : api.fallback(route),
    );
    const checkIn = new EventCheckInPage(page);
    await api.signInAs(lead(api), `/events/${event.id}/check-in`);

    await checkIn.exportCsv.click();

    const toast = checkIn.toast('We couldn’t export the attendance');
    await expect(toast).toContainText('Check your connection and try again.');
    await axe.check();
    fail = false;
    const download = page.waitForEvent('download');
    await toast.getByRole('button', { name: 'Try again' }).click();
    expect((await download).suggestedFilename()).toBe('toronto-builders-night-attendance.csv');
  });
});
