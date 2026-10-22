// Traces to: L2-049, L2-045 AC1 (docs/detailed-designs/platform/home)
import { Route } from '@playwright/test';

import { expect, test } from '../../fixtures/app';
import { MockApi } from '../../fixtures/mock-api';
import { HomePage } from '../../pages/home.page';
import { BREAKPOINTS, BreakpointName, hasHorizontalScroll } from '../../pages/viewport';

test.use({ timezoneId: 'America/Toronto' });

/** 3:42 pm on Wednesday 21 October 2026 in Toronto. */
const NOW = new Date('2026-10-21T19:42:00Z');

async function arrange(api: MockApi) {
  api.now = NOW;
  await api.freezeBrowserClock();
  const prayer = api.events.add({
    title: 'City Team Prayer & Planning',
    startsAt: '2026-10-28T23:00:00Z',
    endsAt: '2026-10-29T00:30:00Z',
    format: 'Online',
    venue: null,
    onlineLink: 'https://meet.example.org/prayer',
  });
  api.events.add({
    title: 'Austin Faith & AI Panel',
    startsAt: '2026-10-30T23:00:00Z',
    endsAt: '2026-10-31T01:00:00Z',
    city: 'Austin',
    isCancelled: true,
    cancellationReason: 'Our panelists are ill.',
  });
  const builders = api.events.add({
    title: 'Toronto Builders Night',
    startsAt: '2026-11-06T23:30:00Z',
    endsAt: '2026-11-07T02:00:00Z',
    visibility: 'Public',
  });
  api.events.addRsvps(builders, 34);
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
    city: 'Vancouver',
  });
  api.events.add({
    title: 'Spring retreat',
    startsAt: '2026-04-11T14:00:00Z',
    endsAt: '2026-04-11T20:00:00Z',
  });
  for (const [name, stage] of [
    ['Kestrel Labs', 'Lead'],
    ['Northwind Church', 'Lead'],
    ['Maple Grants', 'InFunnel'],
    ['Harbour Trust', 'Confirmed'],
  ] as const) {
    api.partners.add({ name, stage });
  }
  return { prayer };
}

function addGrace(api: MockApi) {
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
  return grace;
}

/** Answers `path` with 503 until `ok()` is called, then as the fake normally would. */
function failUntilFixed(api: MockApi, path: string) {
  let failing = true;
  api.on('GET', path, (route: Route) =>
    failing ? route.fulfill({ status: 503 }) : api.fallback(route),
  );
  return () => (failing = false);
}

test.describe('Home', () => {
  test('a lead sees the greeting, Coming up, quick actions, the pipeline and their activity', async ({
    page,
    api,
    axe,
  }) => {
    const { prayer } = await arrange(api);
    const grace = addGrace(api);
    const home = new HomePage(page);

    await api.signInAs(grace, '/');

    await expect(home.heading).toHaveText('Good afternoon, Grace');
    await expect(home.subtitle).toHaveText('Wednesday 21 October · 4 events coming up');
    await expect(home.comingUpEvents).toHaveCount(3);
    await expect(home.comingUpEvents.nth(0)).toContainText('City Team Prayer & Planning');
    await expect(home.comingUpEvents.nth(0)).toContainText('Wed 28 Oct · 7:00 pm · Online');
    await expect(home.comingUpEvents.nth(0)).toContainText('Members only');
    await expect(home.comingUpEvents.nth(1)).toContainText(
      'Fri 6 Nov · 6:30 pm · Kestrel Labs, 220 King St W · 34 going',
    );
    await expect(home.comingUpEvents.nth(1)).toContainText('Public');
    await expect(home.comingUpEvents.nth(2)).toContainText(
      'Sat 14 – Sun 15 Nov · Trinity Community Centre · 52 going',
    );
    await expect(home.comingUp).not.toContainText('Austin Faith & AI Panel');
    await expect(home.comingUpLink('City Team Prayer & Planning')).toHaveAttribute(
      'href',
      `/events/${prayer.id}`,
    );
    await expect(home.allEvents).toHaveAttribute('href', '/events');
    await expect(home.newEvent).toHaveAttribute('href', '/events/new');
    await expect(home.addContact).toHaveAttribute('href', '/contacts/new');
    await expect(home.staffBanner).toHaveCount(0);

    await expect(home.stat('Lead')).toContainText('2');
    await expect(home.stat('In funnel')).toContainText('1');
    await expect(home.stat('Confirmed')).toContainText('1');
    await expect(home.openBoard).toHaveAttribute('href', '/partners');

    await expect(home.activityItems).toHaveCount(2);
    await expect(home.activityItems.nth(0)).toContainText('Tomás Ortega just joined FaithTech');
    await expect(home.activityItems.nth(0)).toContainText('Today, 11:42 am');
    await expect(home.activityItems.nth(1)).toContainText('Sun 18 Oct');
    await expect(home.activityLink('Tomás Ortega just joined FaithTech')).toHaveAttribute(
      'href',
      '/contacts/contact-9',
    );
    await axe.check();

    await home.comingUpLink('City Team Prayer & Planning').click();
    await expect(page).toHaveURL(`/events/${prayer.id}`);
  });

  test('Staff see the read-only banner, no write actions and none of a lead’s private activity', async ({
    page,
    api,
    axe,
  }) => {
    await arrange(api);
    addGrace(api);
    const daniel = api.addAccount({
      email: 'daniel@example.org',
      name: 'Daniel Brooks',
      roles: ['Staff'],
    });
    const home = new HomePage(page);

    await api.signInAs(daniel, '/');

    await expect(home.heading).toHaveText('Good afternoon, Daniel');
    await expect(home.staffBanner).toBeVisible();
    await expect(home.comingUpEvents).toHaveCount(3);
    await expect(home.stat('Lead')).toContainText('2');
    await expect(home.newEvent).toHaveCount(0);
    await expect(home.addContact).toHaveCount(0);
    await expect(home.noActivity).toBeVisible();
    await expect(page.getByRole('main')).not.toContainText('Tomás Ortega');
    await axe.check();
  });

  test('a volunteer sees Coming up and activity, but no pipeline and no actions', async ({
    page,
    api,
    axe,
  }) => {
    await arrange(api);
    const ruth = api.addAccount({
      email: 'ruth@example.org',
      name: 'Ruth Alvarez',
      roles: ['Volunteer'],
    });
    api.addNotification({
      recipientId: ruth.profileId,
      kind: 'RoleChanged',
      title: 'You’re now a Volunteer',
      linkPath: '/people/me',
    });
    const home = new HomePage(page);

    await api.signInAs(ruth, '/');

    await expect(home.comingUpEvents).toHaveCount(3);
    await expect(home.activityItems).toHaveCount(1);
    await expect(home.activityLink('You’re now a Volunteer')).toHaveAttribute('href', '/people/me');
    await expect(home.pipeline).toHaveCount(0);
    await expect(home.newEvent).toHaveCount(0);
    await expect(home.addContact).toHaveCount(0);
    expect(api.callsTo('GET', '/api/partners')).toEqual([]);
    await axe.check();
  });

  test('a member with no role sees how to get started', async ({ page, api, axe }) => {
    await arrange(api);
    const leah = api.addAccount({ email: 'leah@example.org', name: 'Leah Thompson', roles: [] });
    const home = new HomePage(page);

    await api.signInAs(leah, '/');

    await expect(home.heading).toHaveText('Welcome, Leah');
    await expect(home.subtitle).toHaveText(
      'You’re part of the FaithTech community. Here’s how to get started.',
    );
    await expect(
      home.onboardingCard('Finish your profile').getByRole('link', { name: 'Edit profile' }),
    ).toHaveAttribute('href', '/people/me/edit');
    await expect(
      home.onboardingCard('Find an event').getByRole('link', { name: 'Browse events' }),
    ).toHaveAttribute('href', '/events');
    await expect(
      home.onboardingCard('Want to get involved?').getByRole('link', { name: 'Meet the team' }),
    ).toHaveAttribute('href', '/team');
    await expect(home.noActivity).toBeVisible();
    await expect(home.comingUp).toHaveCount(0);
    await expect(home.pipeline).toHaveCount(0);
    await axe.check();
  });

  test('while home loads, every card keeps its place with skeletons', async ({
    page,
    api,
    axe,
  }) => {
    await arrange(api);
    const grace = addGrace(api);
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    for (const path of ['/api/events', '/api/partners', '/api/activity']) {
      api.on('GET', path, async (route) => {
        await held;
        await api.fallback(route);
      });
    }
    const home = new HomePage(page);

    await api.signInAs(grace, '/');

    await expect(home.heading).toHaveText('Good afternoon, Grace');
    await expect(home.comingUpLoading).toBeVisible();
    await expect(home.stat('Lead')).toHaveAttribute('aria-busy', 'true');
    await expect(home.activityLoading).toBeVisible();
    await axe.check();

    release();
    await expect(home.comingUpEvents).toHaveCount(3);
    await expect(home.stat('Lead')).toContainText('2');
    await expect(home.activityItems).toHaveCount(2);
  });

  test('when home cannot load, it says so and Try again loads it', async ({ page, api, axe }) => {
    await arrange(api);
    const grace = addGrace(api);
    const fix = failUntilFixed(api, '/api/events');
    const home = new HomePage(page);

    await api.signInAs(grace, '/');

    await expect(home.pageError).toBeVisible();
    await expect(home.comingUp).toHaveCount(0);
    await axe.check();

    fix();
    await home.tryAgain();
    await expect(home.comingUpEvents).toHaveCount(3);
    await expect(home.activityItems).toHaveCount(2);
  });

  test('a lead with no upcoming events or partners sees zero states', async ({
    page,
    api,
    axe,
  }) => {
    api.now = NOW;
    await api.freezeBrowserClock();
    const grace = addGrace(api);
    const home = new HomePage(page);

    await api.signInAs(grace, '/');

    await expect(home.subtitle).toHaveText('Wednesday 21 October · No events coming up');
    await expect(home.nothingComingUp).toBeVisible();
    await expect(home.allEvents).toBeVisible();
    await expect(home.stat('Lead')).toContainText('0');
    await expect(home.stat('In funnel')).toContainText('0');
    await expect(home.stat('Confirmed')).toContainText('0');
    await expect(home.noPartners).toBeVisible();
    await axe.check();
  });

  test('when the pipeline fails, only its card says so, and Try again reloads it', async ({
    page,
    api,
    axe,
  }) => {
    await arrange(api);
    const grace = addGrace(api);
    const fix = failUntilFixed(api, '/api/partners');
    const home = new HomePage(page);

    await api.signInAs(grace, '/');

    await expect(home.pipelineError).toContainText('We couldn’t load the partner pipeline');
    await expect(home.pipelineError).toContainText('The rest of the page is up to date.');
    await expect(home.comingUpEvents).toHaveCount(3);
    await expect(home.activityItems).toHaveCount(2);
    await axe.check();

    fix();
    await home.tryAgain(home.pipeline);
    await expect(home.stat('Lead')).toContainText('2');
    await expect(home.pipelineError).toHaveCount(0);
  });

  test('when activity fails, only its card says so, and Try again reloads it', async ({
    page,
    api,
    axe,
  }) => {
    await arrange(api);
    const grace = addGrace(api);
    const fix = failUntilFixed(api, '/api/activity');
    const home = new HomePage(page);

    await api.signInAs(grace, '/');

    await expect(home.activityError).toContainText('We couldn’t load recent activity');
    await expect(home.comingUpEvents).toHaveCount(3);
    await expect(home.stat('Lead')).toContainText('2');
    await axe.check();

    fix();
    await home.tryAgain(home.activity);
    await expect(home.activityItems).toHaveCount(2);
  });
});

for (const name of Object.keys(BREAKPOINTS) as BreakpointName[]) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`home fits without sideways scroll at ${name} in ${colorScheme}`, async ({
      page,
      api,
      axe,
    }) => {
      await page.emulateMedia({ colorScheme });
      await page.setViewportSize(BREAKPOINTS[name]);
      await arrange(api);
      const grace = addGrace(api);
      const home = new HomePage(page);

      await api.signInAs(grace, '/');

      await expect(home.activityItems).toHaveCount(2);
      await expect(home.stat('Lead')).toContainText('2');
      expect(await hasHorizontalScroll(page)).toBe(false);
      await axe.check();
    });
  }
}
