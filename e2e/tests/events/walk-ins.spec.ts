// Traces to: L2-120, L2-118 AC3, AC4 (docs/detailed-designs/events/event-check-in)
import { expect, test } from '../../fixtures/app';
import { MockApi } from '../../fixtures/mock-api';
import { AddWalkInDialog } from '../../pages/add-walk-in.dialog';
import { EventCheckInPage } from '../../pages/event-check-in.page';

test.use({ timezoneId: 'America/Toronto' });

/** Tonight at 6:30 pm Toronto time; the fake's "now" is 8:00 am, so check-in is open. */
function tonight(api: MockApi) {
  const event = api.events.add({
    title: 'Toronto Builders Night',
    startsAt: '2026-10-21T22:30:00.000Z',
    endsAt: '2026-10-22T01:00:00.000Z',
  });
  const ruth = api.addProfile({ name: 'Ruth Alvarez' });
  api.events.addMember(event, ruth.id, 5);
  api.events.addGuest(event, 'Abby Brooks', 'abby.brooks@example.org', 4);
  return event;
}

function lead(api: MockApi) {
  return api.addAccount({
    email: 'grace@example.org',
    name: 'Grace Okonkwo',
    roles: ['EventLead'],
  });
}

test.describe('Walk-ins', () => {
  // L2-120 AC1: Given a lead on the check-in page, when they choose "Add walk-in", then a dialog asks for a name
  // (required) and an optional email, with "Check them in now" on by default and described by
  // "Adds them to the attendance list as present." (aria-describedby).
  // L2-120 AC2: when the lead saves, the walk-in is added to the end of the list, checked in with the time.
  test('a lead adds a walk-in who is checked in at once', async ({ page, api, axe }) => {
    const event = tonight(api);
    const checkIn = new EventCheckInPage(page);
    const dialog = new AddWalkInDialog(page);
    await api.signInAs(lead(api), `/events/${event.id}/check-in`);

    await checkIn.addWalkIn.click();
    await dialog.opened();
    await expect(dialog.dialog).toContainText('For someone at the door who didn’t RSVP.');
    await expect(dialog.dialog).toContainText(
      'A member’s email links the check-in to their profile.',
    );
    await expect(dialog.checkInNow).toBeChecked();
    await expect(dialog.checkInNow).toHaveAccessibleDescription(
      'Adds them to the attendance list as present.',
    );
    await axe.check();

    await dialog.name.fill('Mira Chen');
    await dialog.email.fill('mira.chen@example.org');
    await dialog.save.click();

    await expect(dialog.dialog).toHaveCount(0);
    expect(await checkIn.names()).toEqual(['Ruth Alvarez', 'Abby Brooks', 'Mira Chen']);
    await expect(checkIn.attendee('Mira Chen')).toContainText(
      'Walk-in · mira.chen@example.org · Checked in 8:00 am',
    );
    await expect(checkIn.switchFor('Mira Chen')).toBeChecked();
    await expect(checkIn.meter).toHaveAccessibleName('1 of 3 checked in');
    await expect(page.getByText('· 1 walk-in')).toBeVisible();
    await expect(checkIn.toast('Mira Chen is checked in')).toBeVisible();
    // L2-120 AC7: no RSVP confirmation email is sent.
    expect(api.events.emails).toEqual([]);
    await axe.check();
  });

  test('a walk-in added with Check them in now off is not here yet', async ({ page, api }) => {
    const event = tonight(api);
    const checkIn = new EventCheckInPage(page);
    const dialog = new AddWalkInDialog(page);
    await api.signInAs(lead(api), `/events/${event.id}/check-in`);

    await checkIn.addWalkIn.click();
    await dialog.name.fill('Ben Carter');
    await dialog.checkInNow.click();
    await expect(dialog.save).toHaveText('Add walk-in');
    await dialog.save.click();

    await expect(checkIn.attendee('Ben Carter')).toContainText('Walk-in · Not here yet');
    await expect(checkIn.switchFor('Ben Carter')).not.toBeChecked();
    await expect(checkIn.toast('Ben Carter is on the list')).toBeVisible();
  });

  // L2-120 AC3: Given no name or an invalid email, when the lead saves, then the field shows an inline error and
  // nothing is saved.
  test('a walk-in needs a name and a valid email if one is given', async ({ page, api, axe }) => {
    const event = tonight(api);
    const checkIn = new EventCheckInPage(page);
    const dialog = new AddWalkInDialog(page);
    await api.signInAs(lead(api), `/events/${event.id}/check-in`);

    await checkIn.addWalkIn.click();
    await dialog.email.fill('mira.chen@');
    await dialog.save.click();

    await expect(dialog.error('Enter their name so the list shows who came.')).toBeVisible();
    await expect(
      dialog.error('Enter an email like name@example.com, or leave it empty.'),
    ).toBeVisible();
    await expect(dialog.name).toHaveAttribute('aria-invalid', 'true');
    expect(api.callsTo('POST', `/api/events/${event.id}/walk-ins`)).toEqual([]);
    await axe.check();
  });

  test('a failed save keeps the dialog open with Try again', async ({ page, api, axe }) => {
    const event = tonight(api);
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => (release = resolve));
    api.on('POST', `/api/events/${event.id}/walk-ins`, async (route) => {
      await held;
      return route.abort('failed');
    });
    const checkIn = new EventCheckInPage(page);
    const dialog = new AddWalkInDialog(page);
    await api.signInAs(lead(api), `/events/${event.id}/check-in`);

    await checkIn.addWalkIn.click();
    await dialog.name.fill('Mira Chen');
    await dialog.save.click();

    await expect(dialog.save).toHaveText('Adding…');
    await expect(dialog.name).toBeDisabled();
    await axe.check();
    release();

    await expect(dialog.failed).toContainText(
      'We couldn’t reach the server. Mira Chen is not on the list yet; try again.',
    );
    await expect(dialog.save).toHaveText('Try again');
    await expect(dialog.name).toHaveValue('Mira Chen');
    await axe.check();
  });

  // L2-120 AC4: Given an email that belongs to a verified member's account, then the row is linked to that
  // member's profile and shows as a member.
  test('a verified member’s email links the walk-in to their profile', async ({ page, api }) => {
    const event = tonight(api);
    const mira = api.addAccount({ email: 'mira.chen@example.org', name: 'Mira Chen' });
    const checkIn = new EventCheckInPage(page);
    const dialog = new AddWalkInDialog(page);
    await api.signInAs(lead(api), `/events/${event.id}/check-in`);

    await checkIn.addWalkIn.click();
    await dialog.name.fill('Mira');
    await dialog.email.fill('Mira.Chen@example.org');
    await dialog.save.click();

    await expect(checkIn.attendee('Mira Chen')).toContainText('Walk-in · Checked in 8:00 am');
    expect(event.rsvps.at(-1)).toMatchObject({ profileId: mira.profileId, isWalkIn: true });
  });

  // L2-120 AC5: Given the email already has an RSVP, then that RSVP is reused rather than a second row created.
  test('an existing RSVP is reused and checked in', async ({ page, api }) => {
    const event = tonight(api);
    const checkIn = new EventCheckInPage(page);
    const dialog = new AddWalkInDialog(page);
    await api.signInAs(lead(api), `/events/${event.id}/check-in`);

    await checkIn.addWalkIn.click();
    await dialog.name.fill('Abby');
    await dialog.email.fill('abby.brooks@example.org');
    await dialog.save.click();

    await expect(checkIn.toast('Abby Brooks already RSVP’d and is checked in')).toBeVisible();
    await expect(checkIn.attendees).toHaveCount(2);
    await expect(checkIn.attendee('Abby Brooks')).toContainText(
      'Guest · abby.brooks@example.org · Checked in 8:00 am',
    );
  });

  // L2-118 AC3: Given a search with no matches, then it offers "Add walk-in" to leads, with the name filled in.
  test('no matches offer to add the search term as a walk-in', async ({ page, api, axe }) => {
    const event = tonight(api);
    const checkIn = new EventCheckInPage(page);
    const dialog = new AddWalkInDialog(page);
    await api.signInAs(lead(api), `/events/${event.id}/check-in`);

    await checkIn.search.fill('mira');
    await checkIn.emptyAction('Add “Mira” as a walk-in').click();

    await expect(dialog.name).toHaveValue('Mira');
    await dialog.save.click();
    await expect(dialog.dialog).toHaveCount(0);
    await expect(checkIn.search).toHaveValue('');
    await expect(checkIn.attendee('Mira')).toContainText('Walk-in · Checked in 8:00 am');
    await axe.check();
  });

  // L2-118 AC4: Given an event with no RSVPs, then the empty state offers "Add walk-in" to leads.
  test('an event without RSVPs offers Add walk-in', async ({ page, api }) => {
    const event = api.events.add({ title: 'City Team Prayer & Planning' }, 0.4);
    const checkIn = new EventCheckInPage(page);
    const dialog = new AddWalkInDialog(page);
    await api.signInAs(lead(api), `/events/${event.id}/check-in`);

    await checkIn.emptyAction('Add walk-in').click();
    await dialog.name.fill('Ben Carter');
    await dialog.save.click();

    await expect(checkIn.attendees).toHaveCount(1);
    await expect(checkIn.meter).toHaveAccessibleName('1 of 1 checked in');
  });
});
