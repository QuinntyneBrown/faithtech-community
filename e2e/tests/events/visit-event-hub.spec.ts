// Traces to: L2-166 AC1 to AC3, L2-167 AC1 to AC4 (docs/detailed-designs/events/visit-event-hub)
import { expect, test } from '../../fixtures/app';
import { MockApi } from '../../fixtures/mock-api';
import { EventPage } from '../../pages/event.page';
import { HubPage } from '../../pages/hub.page';
import { PublicEventPage } from '../../pages/public-event.page';

test.use({ timezoneId: 'America/Toronto' });

function arrange(api: MockApi, visibility: 'Public' | 'MembersOnly', publish = true) {
  const event = api.events.add({
    title: 'Toronto Builders Night',
    startsAt: '2026-11-06T23:30:00.000Z',
    endsAt: '2026-11-07T02:00:00.000Z',
    venue: 'Kestrel Labs, 220 King St W, Toronto',
    visibility,
  });
  api.events.hubs.add(event);
  if (publish) api.events.hubs.publish(event.id);
  return event;
}

test.describe('Visit an event hub', () => {
  // L2-167 AC2, AC1, L2-166 AC1: an anonymous visitor goes from the public event page to the published hub.
  test('an anonymous visitor opens a published hub from the public event page', async ({
    page,
    api,
    axe,
  }) => {
    const event = arrange(api, 'Public');
    api.events.hubs.fill(event.id, 'Hero', { subtitle: 'A night of building for the city' });
    const publicPage = new PublicEventPage(page);
    const hub = new HubPage(page);

    await publicPage.open(event.id);
    await expect(
      page.getByText('The agenda, venue, people and links for the day, in one place.'),
    ).toBeVisible();
    await axe.check();
    await publicPage.openHub.click();

    await expect(page).toHaveURL(new RegExp(`/public/events/${event.id}/hub$`));
    await expect(hub.sectionHeadings.first()).toHaveText('Toronto Builders Night');
    await expect(hub.banner).toBeHidden();
    await expect(page).toHaveTitle('Toronto Builders Night');
    expect(await hub.description()).toBe('A night of building for the city');
    await expect(hub.rsvp).toHaveAttribute('href', new RegExp(`/public/events/${event.id}$`));
    await axe.check();
  });

  // L2-167 AC1: without a subtitle, the meta description is the event's date, time and place.
  test('without a subtitle the description is the event’s date, time and place', async ({
    page,
    api,
  }) => {
    const event = arrange(api, 'Public');
    const hub = new HubPage(page);

    await hub.open(event.id);

    await expect(hub.sectionHeadings.first()).toHaveText('Toronto Builders Night');
    expect(await hub.description()).toBe(
      'Fri 6 Nov 2026 · 6:30 – 9:00 pm · Kestrel Labs, 220 King St W, Toronto',
    );
  });

  // L2-166 AC2, AC3: an anonymous visitor cannot open a members-only or draft hub, and is offered Sign in.
  test('an anonymous visitor cannot open a members-only or draft hub and can sign in', async ({
    page,
    api,
    axe,
  }) => {
    const membersOnly = arrange(api, 'MembersOnly');
    const draft = arrange(api, 'Public', false);
    const hub = new HubPage(page);
    const publicPage = new PublicEventPage(page);

    await hub.open(membersOnly.id);
    await expect(hub.notAvailable).toBeVisible();
    await expect(
      hub.text(
        'It may not be published yet, or it may be for members only. Members can sign in to see it.',
      ),
    ).toBeVisible();
    await expect(hub.signIn).toHaveAttribute(
      'href',
      `/sign-in?returnUrl=${encodeURIComponent(`/public/events/${membersOnly.id}/hub`)}`,
    );
    await axe.check();

    await hub.open(draft.id);
    await expect(hub.notAvailable).toBeVisible();
    await publicPage.open(draft.id);
    await expect(publicPage.heading).toHaveText('Toronto Builders Night');
    await expect(publicPage.openHub).toBeHidden();
  });

  // L2-167 AC3, L2-166 AC2: a member opens a members-only hub from the event page.
  test('a member opens a members-only hub from the event page', async ({ page, api, axe }) => {
    const event = arrange(api, 'MembersOnly');
    const ruth = api.addAccount({
      email: 'ruth@example.org',
      name: 'Ruth Alvarez',
      roles: ['Staff'],
    });
    const eventPage = new EventPage(page);
    const hub = new HubPage(page);
    await api.signInAs(ruth, `/events/${event.id}`);

    await eventPage.visitHub.click();

    await expect(hub.sectionHeadings.first()).toHaveText('Toronto Builders Night');
    await expect(hub.banner).toBeHidden();
    await axe.check();
  });

  // L2-166 AC3: a signed-in member reads the plain not-available text for a draft hub, with no Sign in.
  test('a member gets the plain not-available text for a draft hub', async ({ page, api }) => {
    const event = arrange(api, 'MembersOnly', false);
    const ruth = api.addAccount({
      email: 'ruth@example.org',
      name: 'Ruth Alvarez',
      roles: ['Staff'],
    });
    const eventPage = new EventPage(page);
    const hub = new HubPage(page);
    await api.signInAs(ruth, `/events/${event.id}`);
    await expect(eventPage.heading).toHaveText('Toronto Builders Night');
    await expect(eventPage.visitHub).toBeHidden();

    await hub.open(event.id);

    await expect(hub.text('It may not be published yet, or the link may be wrong.')).toBeVisible();
    await expect(hub.signIn).toBeHidden();
  });
});
