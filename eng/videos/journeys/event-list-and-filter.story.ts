import { expect, test } from '../../../e2e/fixtures/app';
import { EventsPage } from '../../../e2e/pages/events.page';
import { Presenter } from '../presenter';

test.use({ timezoneId: 'America/Toronto' });

// Journey: event list and filters (docs/detailed-designs/events/event-list-and-filter, L2-021).
test('event-list-and-filter', async ({ page, api }) => {
  const show = await Presenter.start(page, 'event-list-and-filter');
  const events = new EventsPage(page);
  const grace = api.addAccount({
    email: 'grace@example.org',
    name: 'Grace Okafor',
    roles: ['EventLead'],
  });

  const builders = api.events.add({
    title: 'Toronto Builders Night',
    type: 'builders-night',
    startsAt: '2026-11-06T23:30:00Z',
    endsAt: '2026-11-07T02:00:00Z',
    visibility: 'Public',
  });
  api.events.addRsvps(builders, 34);
  api.events.add({
    title: 'Austin Faith & AI Panel',
    type: 'panel',
    startsAt: '2026-10-30T23:00:00Z',
    endsAt: '2026-10-31T01:00:00Z',
    city: 'Austin',
    format: 'Online',
    venue: null,
    onlineLink: 'https://meet.example.org/panel',
    isCancelled: true,
    cancellationReason: 'Our panelists are ill.',
  });
  const hackathon = api.events.add({
    title: 'Hackathon: Tech for Shelters',
    type: 'hackathon',
    startsAt: '2026-11-14T14:00:00Z',
    endsAt: '2026-11-15T22:00:00Z',
    venue: 'Trinity Community Centre',
    visibility: 'Public',
  });
  api.events.addRsvps(hackathon, 52);
  api.events.add({
    title: 'Vancouver Advent Build Night',
    startsAt: '2026-12-05T03:00:00Z',
    endsAt: '2026-12-05T04:30:00Z',
    city: 'Vancouver',
    format: 'Online',
    venue: null,
    onlineLink: 'https://meet.example.org/advent',
    visibility: 'Public',
  });
  api.events.add({
    title: 'Spring hackathon',
    type: 'hackathon',
    startsAt: '2026-04-11T14:00:00Z',
    endsAt: '2026-04-12T22:00:00Z',
  });

  await show.card(
    'opening',
    'opening',
    ['Find the right event', 'Recorded against a local fake API · synthetic people and events'],
    () => api.signInAs(grace, '/events'),
  );

  await show.step(
    'list',
    async () => {
      await expect(events.heading).toHaveText('Events');
      await expect.poll(() => events.titles()).toHaveLength(4);
      await expect(events.event('Toronto Builders Night')).toContainText('34 going');
      await expect(events.newEvent).toBeVisible();
    },
    { poster: true },
  );

  await show.step('cancelled', async () => {
    await expect(events.event('Austin Faith & AI Panel')).toContainText('Cancelled');
  });

  await show.step('past', async () => {
    await events.filter('Past').click();
    await expect.poll(() => events.titles()).toEqual(['Spring hackathon']);
  });

  await show.step('chips', async () => {
    await events.filter('Upcoming').click();
    await events.type.selectOption({ label: 'Hackathon' });
    await expect.poll(() => events.titles()).toEqual(['Hackathon: Tech for Shelters']);
    await events.type.selectOption({ label: 'All types' });
    await events.filter('Online').click();
    await expect
      .poll(() => events.titles())
      .toEqual(['Austin Faith & AI Panel', 'Vancouver Advent Build Night']);
  });

  await show.step('city', async () => {
    await events.filter('Upcoming').click();
    await events.city.selectOption('Toronto');
    await expect
      .poll(() => events.titles())
      .toEqual(['Toronto Builders Night', 'Hackathon: Tech for Shelters']);
  });

  await show.step('empty', async () => {
    await events.filter('Online').click();
    await expect(events.noResults('No upcoming online events in Toronto')).toBeVisible();
    await page.waitForTimeout(1500);
    await events.showAllCities.click();
    await expect(events.city).toHaveValue('');
  });

  await show.card('closing', 'closing', [
    'Upcoming events first, soonest at the top',
    'Cancelled events are marked',
    'Filter by time, type and city',
  ]);
  await show.finish();
});
