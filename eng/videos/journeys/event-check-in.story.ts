import { expect, test } from '../../../e2e/fixtures/app';
import { AddWalkInDialog } from '../../../e2e/pages/add-walk-in.dialog';
import { EventCheckInPage } from '../../../e2e/pages/event-check-in.page';
import { EventPage } from '../../../e2e/pages/event.page';
import { Presenter, typeInto } from '../presenter';

test.use({ timezoneId: 'America/Toronto' });

// Journey: event check-in (docs/detailed-designs/events/event-check-in, L2-092 to L2-097).
test('event-check-in', async ({ page, api }) => {
  const show = await Presenter.start(page, 'event-check-in');
  const eventPage = new EventPage(page);
  const checkIn = new EventCheckInPage(page);
  const walkIn = new AddWalkInDialog(page);
  // Tonight at 6:30 pm Toronto time; the fake's "now" is 8:00 am, so check-in is open.
  const event = api.events.add({
    title: 'Toronto Builders Night',
    startsAt: '2026-10-21T22:30:00.000Z',
    endsAt: '2026-10-22T01:00:00.000Z',
  });
  for (const [name, daysAgo] of [
    ['Ruth Alvarez', 9],
    ['Jonah Bell', 7],
    ['Kai Moreau', 4],
  ] as const) {
    api.events.addMember(event, api.addProfile({ name }).id, daysAgo);
  }
  api.events.addGuest(event, 'Abby Brooks', 'abby.brooks@example.org', 3);
  api.events.addMember(event, api.addProfile({ name: 'Sam Rivera' }).id, 1);
  const grace = api.addAccount({
    email: 'grace@example.org',
    name: 'Grace Okonkwo',
    roles: ['EventLead'],
  });

  await show.card(
    'opening',
    'opening',
    ['Check people in at the door', 'Recorded against a local fake API · synthetic people'],
    () => api.signInAs(grace, `/events/${event.id}`),
  );

  await show.step('event-page', async () => {
    await expect(eventPage.heading).toHaveText('Toronto Builders Night');
    await expect(eventPage.checkIn).toBeVisible();
    await expect(eventPage.fact('Going')).toHaveText('5 people');
  });

  await show.step('list', async () => {
    await eventPage.checkIn.click();
    await expect(checkIn.heading).toHaveText('Check-in · Toronto Builders Night');
    await expect(checkIn.meter).toHaveAccessibleName('0 of 5 checked in');
    await expect(checkIn.attendees).toHaveCount(5);
  });

  await show.step('search', async () => {
    await typeInto(checkIn.search, 'abby');
    await expect(checkIn.attendees).toHaveCount(1);
    await checkIn.switchFor('Abby Brooks').click();
    await expect(checkIn.attendee('Abby Brooks')).toContainText('Checked in 8:00 am');
    await expect(checkIn.toast('Abby Brooks is checked in')).toContainText('1 of 5 here.');
    // The lead reaches for Undo; hovering the toast pauses its timer while the narration runs.
    await checkIn.toast('Abby Brooks is checked in').getByRole('button', { name: 'Undo' }).hover();
  });

  await show.step('undo', async () => {
    await page.waitForTimeout(800);
    await checkIn.toast('Abby Brooks is checked in').getByRole('button', { name: 'Undo' }).click();
    await expect(checkIn.switchFor('Abby Brooks')).not.toBeChecked();
    await expect(checkIn.attendee('Abby Brooks')).toContainText('Not here yet');
    await checkIn.search.fill('');
    await expect(checkIn.attendees).toHaveCount(5);
  });

  await show.step(
    'check-in-more',
    async () => {
      for (const name of ['Ruth Alvarez', 'Abby Brooks']) {
        await checkIn.switchFor(name).click();
        await expect(checkIn.switchFor(name)).toBeChecked();
        await page.waitForTimeout(600);
      }
      await expect(checkIn.meter).toHaveAccessibleName('2 of 5 checked in');
    },
    { poster: true },
  );

  await show.step('walk-in', async () => {
    await checkIn.addWalkIn.click();
    await walkIn.opened();
    await expect(walkIn.checkInNow).toBeChecked();
    await typeInto(walkIn.name, 'Mira Chen');
    await typeInto(walkIn.email, 'mira.chen@example.org');
  });

  await show.step('walk-in-added', async () => {
    await walkIn.save.click();
    await expect(walkIn.dialog).toHaveCount(0);
    await expect(checkIn.attendee('Mira Chen')).toContainText('Walk-in · mira.chen@example.org');
    await expect(checkIn.switchFor('Mira Chen')).toBeChecked();
    await expect(checkIn.meter).toHaveAccessibleName('3 of 6 checked in');
  });

  await show.step('export', async () => {
    const download = page.waitForEvent('download');
    await checkIn.exportCsv.click();
    expect((await download).suggestedFilename()).toBe('toronto-builders-night-attendance.csv');
    await expect(checkIn.toast('Attendance exported')).toBeVisible();
  });

  await show.step('attendance', async () => {
    await eventPage.open(event.id);
    await expect(eventPage.fact('Going')).toHaveText('5 people · 3 checked in');
    await expect(page.getByRole('heading', { name: 'Going (5) · 3 checked in' })).toBeVisible();
  });

  await show.card('closing', 'closing', [
    'Find someone and check them in with one switch',
    'Undo a mistake, add walk-ins at the door',
    'Attendance on the event page and as CSV',
  ]);
  await show.finish();
});
