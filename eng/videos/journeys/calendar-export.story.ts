import { expect, test } from '../../../e2e/fixtures/app';
import { EventPage } from '../../../e2e/pages/event.page';
import { PublicEventPage } from '../../../e2e/pages/public-event.page';
import { Presenter } from '../presenter';

test.use({ timezoneId: 'America/Toronto' });

// Journey: calendar export (docs/detailed-designs/events/calendar-export, L2-024).
test('calendar-export', async ({ page, api }) => {
  const show = await Presenter.start(page, 'calendar-export');
  const eventPage = new EventPage(page);
  const publicPage = new PublicEventPage(page);

  const event = api.events.add({
    title: 'Toronto Builders Night',
    startsAt: '2026-11-06T23:30:00.000Z',
    endsAt: '2026-11-07T02:00:00.000Z',
    visibility: 'Public',
  });
  const leah = api.addAccount({
    email: 'leah@example.org',
    name: 'Leah Thompson',
    roles: ['Attendee'],
  });

  await show.card(
    'opening',
    'opening',
    [
      'Put an event in your calendar',
      'Recorded against a local fake API · synthetic people and events',
    ],
    () => api.signInAs(leah, `/events/${event.id}`),
  );

  await show.step(
    'member-download',
    async () => {
      await expect(eventPage.heading).toHaveText('Toronto Builders Night');
      const [file] = await Promise.all([
        page.waitForEvent('download'),
        eventPage.addToCalendar.click(),
      ]);
      expect(file.suggestedFilename()).toBe('toronto-builders-night.ics');
    },
    { poster: true },
  );

  await show.step('public-download', async () => {
    await publicPage.open(event.id);
    await expect(publicPage.heading).toHaveText('Toronto Builders Night');
    const [file] = await Promise.all([
      page.waitForEvent('download'),
      publicPage.addToCalendar.click(),
    ]);
    expect(file.suggestedFilename()).toBe('toronto-builders-night.ics');
  });

  await show.step('cancelled-update', async () => {
    event.isCancelled = true;
    event.sequence++;
    await eventPage.open(event.id);
    await expect(eventPage.updateCalendar).toBeVisible();
    const [file] = await Promise.all([
      page.waitForEvent('download'),
      eventPage.updateCalendar.click(),
    ]);
    expect(file.suggestedFilename()).toBe('toronto-builders-night.ics');
  });

  await show.card('closing', 'closing', [
    'A standard calendar file',
    'On member and public pages',
    'Updates replace the old entry',
  ]);
  await show.finish();
});
