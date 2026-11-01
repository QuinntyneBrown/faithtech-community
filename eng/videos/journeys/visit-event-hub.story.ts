import { expect, test } from '../../../e2e/fixtures/app';
import { HubPage } from '../../../e2e/pages/hub.page';
import { PublicEventPage } from '../../../e2e/pages/public-event.page';
import { SignInPage } from '../../../e2e/pages/sign-in.page';
import { Presenter } from '../presenter';

test.use({ timezoneId: 'America/Toronto' });

// Journey: visit an event hub (docs/detailed-designs/events/visit-event-hub, L2-166 to L2-168).
test('visit-event-hub', async ({ page, api }) => {
  const show = await Presenter.start(page, 'visit-event-hub');
  const publicPage = new PublicEventPage(page);
  const hub = new HubPage(page);
  const signIn = new SignInPage(page);

  const event = api.events.add({
    title: 'Toronto Builders Night',
    startsAt: '2026-11-06T23:30:00.000Z',
    endsAt: '2026-11-07T02:00:00.000Z',
    venue: 'Kestrel Labs, 220 King St W, Toronto',
    visibility: 'Public',
  });
  api.events.hubs.add(event, ['People', 'Links']);
  api.events.hubs.fill(event.id, 'Hero', { subtitle: 'A night of building for the city' });
  api.events.hubs.fill(event.id, 'Agenda', {
    items: [
      {
        startsAt: '2026-11-06T23:30:00.000Z',
        title: 'Doors open',
        detail: 'Grab a coffee and find a table.',
      },
      {
        startsAt: '2026-11-07T00:00:00.000Z',
        title: 'Build time',
        detail: 'Pair up on the shelter check-in app.',
      },
      { startsAt: '2026-11-07T01:00:00.000Z', title: 'Code freeze', detail: null },
      {
        startsAt: '2026-11-07T01:15:00.000Z',
        title: 'Demos and feedback',
        detail: 'Three minutes per team, then questions.',
      },
      {
        startsAt: '2026-11-07T01:45:00.000Z',
        title: 'Wrap up and prayer',
        detail: 'Grace Okonkwo closes the night.',
      },
    ],
  });
  api.events.hubs.publish(event.id);

  const planning = api.events.add({
    title: 'City Team Prayer and Planning',
    startsAt: '2026-11-10T00:00:00.000Z',
    endsAt: '2026-11-10T01:30:00.000Z',
    format: 'Online',
    venue: null,
    onlineLink: 'https://meet.example.org/city-team',
    visibility: 'MembersOnly',
  });
  api.events.hubs.add(planning, ['People', 'Links', 'Giving']);
  api.events.hubs.publish(planning.id);
  const ruth = api.addAccount({
    email: 'ruth@example.org',
    name: 'Ruth Alvarez',
    roles: ['Staff'],
  });

  // 7:59:40 pm in Toronto: Build time is on, and Code freeze starts in twenty seconds.
  await api.startBrowserClock('2026-11-07T00:59:40.000Z');

  await show.card(
    'opening',
    'opening',
    ['Visit an event hub', 'Recorded against a local fake API · synthetic people and events'],
    () => publicPage.open(event.id),
  );

  await show.step(
    'card',
    async () => {
      await expect(publicPage.openHub).toBeVisible();
      await publicPage.openHub.scrollIntoViewIfNeeded();
    },
    { poster: false },
  );

  await show.step(
    'hub',
    async () => {
      await publicPage.openHub.click();
      await expect(hub.sectionHeadings.first()).toHaveText('Toronto Builders Night');
    },
    { poster: true },
  );

  await show.step('now', async () => {
    await hub.agendaRow('Build time').scrollIntoViewIfNeeded();
    await expect(hub.agendaRow('Build time')).toContainText('Happening now');
  });

  await show.step('moves', async () => {
    await api.advanceBrowserClock(30_000);
    await expect(hub.agendaRow('Code freeze')).toContainText('Happening now');
  });

  await show.step('rest', async () => {
    await hub.sectionHeadings.last().scrollIntoViewIfNeeded();
  });

  await show.step('members', async () => {
    await hub.open(planning.id);
    await expect(hub.notAvailable).toBeVisible();
    await expect(hub.signIn).toBeVisible();
  });

  await show.step('signed-in', async () => {
    await hub.signIn.click();
    await signIn.signIn(ruth.email, ruth.password);
    await expect(hub.sectionHeadings.first()).toHaveText('City Team Prayer and Planning');
  });

  await show.card('closing', 'closing', [
    'One link for the whole day',
    'The agenda knows what’s on now',
    'Members-only hubs stay for members',
  ]);
  await show.finish();
});
