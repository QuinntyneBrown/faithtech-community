import { expect, test } from '../../../e2e/fixtures/app';
import { HomePage } from '../../../e2e/pages/home.page';
import { Presenter } from '../presenter';

test.use({ timezoneId: 'America/Toronto' });

// Journey: the home page (docs/detailed-designs/platform/home, L2-049).
test('home', async ({ page, api }) => {
  const show = await Presenter.start(page, 'home');
  const home = new HomePage(page);
  api.now = new Date('2026-10-21T19:42:00Z');
  await api.freezeBrowserClock();
  api.events.add({
    title: 'City Team Prayer & Planning',
    startsAt: '2026-10-28T23:00:00Z',
    endsAt: '2026-10-29T00:30:00Z',
    format: 'Online',
    venue: null,
    onlineLink: 'https://meet.example.org/prayer',
  });
  const builders = api.events.add({
    title: 'Toronto Builders Night',
    startsAt: '2026-11-06T23:30:00Z',
    endsAt: '2026-11-07T02:00:00Z',
    visibility: 'Public',
  });
  api.events.addRsvps(builders, 34);
  for (const [name, stage] of [
    ['Kestrel Labs', 'Lead'],
    ['Northwind Church', 'Lead'],
    ['Maple Grants', 'InFunnel'],
    ['Harbour Trust', 'Confirmed'],
  ] as const) {
    api.partners.add({ name, stage });
  }
  const grace = api.addAccount({
    email: 'grace@example.org',
    name: 'Grace Okonkwo',
    roles: ['CityLead'],
  });
  api.addNotification(
    {
      recipientId: grace.profileId,
      kind: 'ContactSignedUp',
      title: 'Tomás Ortega just joined FaithTech',
      linkPath: '/contacts/contact-9',
    },
    240,
  );
  api.addNotification(
    {
      recipientId: grace.profileId,
      kind: 'InviteAccepted',
      title: 'Ruth Alvarez accepted your invite',
      linkPath: '/people/profile-ruth',
    },
    3 * 24 * 60,
  );

  await show.card(
    'opening',
    'opening',
    ['Your home page', 'Recorded against a local fake API · synthetic data'],
    () => api.signInAs(grace, '/'),
  );

  await show.step('greeting', async () => {
    await expect(home.heading).toHaveText('Good afternoon, Grace');
    await expect(home.subtitle).toContainText('Wednesday 21 October');
  });

  await show.step(
    'coming-up',
    async () => {
      await expect(home.comingUpEvents).toHaveCount(2);
      await expect(home.comingUpEvents.nth(0)).toContainText('City Team Prayer & Planning');
      await expect(home.allEvents).toBeVisible();
    },
    { poster: true },
  );

  await show.step('quick-actions', async () => {
    await expect(home.newEvent).toBeVisible();
    await expect(home.addContact).toBeVisible();
  });

  await show.step('pipeline', async () => {
    await home.pipeline.scrollIntoViewIfNeeded();
    await expect(home.stat('Lead')).toContainText('2');
    await expect(home.stat('In funnel')).toContainText('1');
    await expect(home.stat('Confirmed')).toContainText('1');
    await expect(home.openBoard).toBeVisible();
  });

  await show.step('activity', async () => {
    await home.activity.scrollIntoViewIfNeeded();
    await expect(home.activityItems).toHaveCount(2);
    await expect(home.activityItems.nth(0)).toContainText('Tomás Ortega just joined FaithTech');
  });

  await show.card('closing', 'closing', [
    'Greeting and the date',
    'Coming up, quick actions and the partner pipeline',
    'Recent activity that matters to you',
  ]);
  await show.finish();
});
