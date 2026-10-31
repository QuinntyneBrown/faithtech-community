// Traces to: L2-021 (docs/detailed-designs/events/event-list-and-filter)
import { expect, test } from '../../fixtures/app';
import { MockApi } from '../../fixtures/mock-api';
import { EventsPage } from '../../pages/events.page';

test.use({ timezoneId: 'America/Toronto' });

function addEvents(api: MockApi) {
  const builders = api.events.add({
    title: 'Toronto Builders Night',
    type: 'BuildersNight',
    startsAt: '2026-11-06T23:30:00Z',
    endsAt: '2026-11-07T02:00:00Z',
    visibility: 'Public',
  });
  api.events.addRsvps(builders, 34);
  api.events.add({
    title: 'Austin Faith & AI Panel',
    type: 'Panel',
    startsAt: '2026-10-30T23:00:00Z',
    endsAt: '2026-10-31T01:00:00Z',
    chapterId: api.chapters.named('Austin').id,
    format: 'Online',
    venue: null,
    onlineLink: 'https://meet.example.org/panel',
    isCancelled: true,
    cancellationReason: 'Our panelists are ill.',
  });
  const hackathon = api.events.add({
    title: 'Hackathon: Tech for Shelters',
    type: 'Hackathon',
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
    chapterId: api.chapters.named('Vancouver').id,
    format: 'Online',
    venue: null,
    onlineLink: 'https://meet.example.org/advent',
    visibility: 'Public',
  });
  api.events.add({
    title: 'Spring hackathon',
    type: 'Hackathon',
    startsAt: '2026-04-11T14:00:00Z',
    endsAt: '2026-04-12T22:00:00Z',
  });
}

test.describe('Event list', () => {
  test('a member sees upcoming events soonest first with date, city, format and RSVPs', async ({
    page,
    api,
    axe,
  }) => {
    addEvents(api);
    const leah = api.addAccount({
      email: 'leah@example.org',
      name: 'Leah Thompson',
      roles: ['Attendee'],
    });
    const events = new EventsPage(page);
    await api.signInAs(leah, '/events');

    await expect(events.heading).toHaveText('Events');
    await expect
      .poll(() => events.titles())
      .toEqual([
        'Austin Faith & AI Panel',
        'Toronto Builders Night',
        'Hackathon: Tech for Shelters',
        'Vancouver Advent Build Night',
      ]);
    await expect(events.event('Toronto Builders Night')).toContainText(
      'Fri 6 Nov · 6:30 pm · Toronto · Kestrel Labs, 220 King St W · 34 going',
    );
    await expect(events.event('Hackathon: Tech for Shelters')).toContainText(
      'Sat 14 – Sun 15 Nov · Toronto · Trinity Community Centre · 52 going',
    );
    await expect(events.event('Vancouver Advent Build Night')).toContainText(
      'Fri 4 Dec · 10:00 pm · Vancouver · Online · 0 going',
    );
    await expect(events.event('Toronto Builders Night')).toContainText('Public');
    await expect(events.newEvent).toHaveCount(0);
    await axe.check();
    await page.emulateMedia({ colorScheme: 'dark' });
    await axe.check();

    await events.link('Toronto Builders Night').click();
    await expect(page).toHaveURL(/\/events\/event-1$/);
  });

  test('a cancelled event is clearly marked as cancelled', async ({ page, api }) => {
    addEvents(api);
    const leah = api.addAccount({ email: 'leah@example.org', roles: ['Attendee'] });
    const events = new EventsPage(page);
    await api.signInAs(leah, '/events');

    await expect(events.event('Austin Faith & AI Panel')).toContainText('Cancelled');
    await expect(events.event('Austin Faith & AI Panel')).not.toContainText('Members only');
    await expect(events.event('Toronto Builders Night')).not.toContainText('Cancelled');
  });

  test('a lead applies the chips and the city filter and gets back to all cities', async ({
    page,
    api,
    axe,
  }) => {
    addEvents(api);
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['EventLead'] });
    const events = new EventsPage(page);
    await api.signInAs(grace, '/events');
    await expect(events.newEvent).toHaveAttribute('href', '/events/new');
    await expect(events.filter('Upcoming')).toHaveAttribute('aria-pressed', 'true');

    await events.filter('Past').click();
    await expect.poll(() => events.titles()).toEqual(['Spring hackathon']);
    await expect(events.filter('Upcoming')).toHaveAttribute('aria-pressed', 'false');

    await events.filter('Hackathons').click();
    await expect.poll(() => events.titles()).toEqual(['Hackathon: Tech for Shelters']);

    await events.filter('Online').click();
    await expect
      .poll(() => events.titles())
      .toEqual(['Austin Faith & AI Panel', 'Vancouver Advent Build Night']);

    await events.filter('Upcoming').click();
    await events.city.selectOption('Toronto');
    await expect
      .poll(() => events.titles())
      .toEqual(['Toronto Builders Night', 'Hackathon: Tech for Shelters']);

    await events.filter('Online').click();
    await expect(events.noResults('No upcoming online events in Toronto')).toBeVisible();
    await axe.check();
    await events.showAllCities.click();
    await expect(events.city).toHaveValue('');
    await expect(events.events).toHaveCount(2);
  });

  test('with no events at all a lead sees the empty state with New event', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const events = new EventsPage(page);
    await api.signInAs(grace, '/events');

    await expect(events.empty).toBeVisible();
    await expect(page.getByRole('link', { name: 'New event' })).toHaveCount(2);
    await axe.check();
  });

  test('a load failure shows the error state and Try again reloads', async ({ page, api, axe }) => {
    addEvents(api);
    const leah = api.addAccount({ email: 'leah@example.org', roles: ['Attendee'] });
    let fail = true;
    api.on('GET', '/api/events', (route) =>
      fail ? route.fulfill({ status: 503 }) : api.fallback(route),
    );
    const events = new EventsPage(page);
    await api.signInAs(leah, '/events');

    await expect(events.loadError).toBeVisible();
    await axe.check();
    fail = false;
    await events.tryAgain.click();
    await expect(events.events).toHaveCount(4);
  });

  test('an anonymous visitor is sent to sign in', async ({ page }) => {
    await page.goto('/events');

    await expect(page).toHaveURL(/\/sign-in/);
  });
});
