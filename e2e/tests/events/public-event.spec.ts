// Traces to: L2-023 (docs/detailed-designs/events/public-events-and-guest-rsvp)
import { expect, test } from '../../fixtures/app';
import { MockApi } from '../../fixtures/mock-api';
import { EventPage } from '../../pages/event.page';
import { GuestCancelRsvpPage } from '../../pages/guest-cancel-rsvp.page';
import { PublicEventPage } from '../../pages/public-event.page';

test.use({ timezoneId: 'America/Toronto' });

function addPublicEvent(api: MockApi) {
  const event = api.events.add({
    title: 'Toronto Builders Night',
    description: 'An evening for Christians who build.',
    startsAt: '2026-11-06T23:30:00.000Z',
    endsAt: '2026-11-07T02:00:00.000Z',
    visibility: 'Public',
  });
  api.events.addRsvps(event, 34);
  return event;
}

test.describe('Public events and guest RSVP', () => {
  test('an anonymous visitor sees a public event and RSVPs as a guest without an account', async ({
    page,
    api,
    axe,
  }) => {
    const event = addPublicEvent(api);
    const publicPage = new PublicEventPage(page);

    await publicPage.open(event.id);

    await expect(publicPage.heading).toHaveText('Toronto Builders Night');
    await expect(publicPage.overline).toHaveText('FaithTech Toronto · Public event');
    await expect(
      page.getByText('Fri 6 Nov 2026 · 6:30 – 9:00 pm · Kestrel Labs, 220 King St W'),
    ).toBeVisible();
    await expect(page.getByText('No account needed. 34 people are going.')).toBeVisible();
    await expect(publicPage.signIn).toHaveAttribute(
      'href',
      `/sign-in?returnUrl=%2Fevents%2F${event.id}`,
    );
    await axe.check();
    await page.emulateMedia({ colorScheme: 'dark' });
    await axe.check();

    await publicPage.rsvp('Abby Brooks', 'abby.brooks@example.org');

    await expect(publicPage.onTheList).toHaveText('You’re on the list, Abby');
    await expect(
      page.getByText('We sent a confirmation to abby.brooks@example.org.'),
    ).toBeVisible();
    expect(event.rsvps.filter((r) => r.guestEmail === 'abby.brooks@example.org')).toHaveLength(1);
    expect(api.accounts.has('abby.brooks@example.org')).toBe(false);
    expect(api.events.emails).toContainEqual(
      expect.objectContaining({
        to: 'abby.brooks@example.org',
        attachment: { fileName: 'toronto-builders-night.ics', contentType: 'text/calendar' },
      }),
    );
    await axe.check();
  });

  test('a guest needs a name and a valid email', async ({ page, api, axe }) => {
    const event = addPublicEvent(api);
    const publicPage = new PublicEventPage(page);
    await publicPage.open(event.id);

    await publicPage.rsvp('', 'abby.brooks@');

    await expect(publicPage.summary).toContainText('Fix 2 things to RSVP');
    expect(await publicPage.error(publicPage.name)).toContain(
      'Enter your name so the host knows who’s coming.',
    );
    expect(await publicPage.error(publicPage.email)).toContain(
      'Enter an email like name@example.org.',
    );
    expect(api.callsTo('POST', `/api/public/events/${event.id}/rsvps`)).toHaveLength(0);
    await axe.check();
  });

  test('the same email twice keeps a single RSVP', async ({ page, api }) => {
    const event = addPublicEvent(api);
    const publicPage = new PublicEventPage(page);
    await publicPage.open(event.id);
    await publicPage.rsvp('Abby Brooks', 'abby.brooks@example.org');
    await expect(publicPage.onTheList).toBeVisible();

    await publicPage.open(event.id);
    await publicPage.rsvp('Abby B', 'Abby.Brooks@example.org');

    await expect(publicPage.onTheList).toBeVisible();
    expect(
      event.rsvps.filter((r) => r.guestEmail?.toLowerCase() === 'abby.brooks@example.org'),
    ).toHaveLength(1);
  });

  test('a members-only event sends the anonymous visitor to sign in', async ({ page, api }) => {
    const event = api.events.add({ title: 'City Team Prayer', visibility: 'MembersOnly' });
    const publicPage = new PublicEventPage(page);

    await publicPage.open(event.id);

    await expect(page).toHaveURL(new RegExp(`/sign-in\\?returnUrl=%2Fevents%2F${event.id}$`));
  });

  test('the eleventh guest RSVP in an hour is turned away', async ({ page, api }) => {
    const event = addPublicEvent(api);
    api.events.guestRequests = 10;
    const publicPage = new PublicEventPage(page);
    await publicPage.open(event.id);

    await publicPage.rsvp('Abby Brooks', 'abby.brooks@example.org');

    await expect(publicPage.failure).toContainText('Too many RSVPs from this connection');
    expect(event.rsvps.some((r) => r.guestEmail === 'abby.brooks@example.org')).toBe(false);
  });

  test('a guest cancels through the link in their confirmation without signing in', async ({
    page,
    api,
    axe,
  }) => {
    const event = addPublicEvent(api);
    const publicPage = new PublicEventPage(page);
    const cancelPage = new GuestCancelRsvpPage(page);
    await publicPage.open(event.id);
    await publicPage.rsvp('Abby Brooks', 'abby.brooks@example.org');
    await expect(publicPage.onTheList).toBeVisible();

    await cancelPage.follow(api.events.cancelLinkFor('abby.brooks@example.org'));

    await expect(cancelPage.heading).toHaveText('Toronto Builders Night');
    await expect(cancelPage.question).toBeVisible();
    expect(event.rsvps.some((r) => r.guestEmail === 'abby.brooks@example.org')).toBe(true);
    await axe.check();
    await cancelPage.cancel.click();

    await expect(cancelPage.cancelled).toBeVisible();
    expect(event.rsvps.some((r) => r.guestEmail === 'abby.brooks@example.org')).toBe(false);
    await axe.check();

    await cancelPage.follow(api.events.cancelLinkFor('abby.brooks@example.org'));
    await cancelPage.cancel.click();
    await expect(cancelPage.invalid).toBeVisible();
  });

  test('a full or cancelled public event takes no RSVPs', async ({ page, api }) => {
    const full = addPublicEvent(api);
    full.capacity = 34;
    const cancelled = api.events.add({
      title: 'Austin Faith & AI Panel',
      chapterId: api.chapters.named('Austin').id,
      visibility: 'Public',
      isCancelled: true,
      cancellationReason: 'Our venue fell through. We’ll reschedule for January.',
    });
    const publicPage = new PublicEventPage(page);

    await publicPage.open(full.id);
    await expect(publicPage.full).toBeVisible();
    await expect(publicPage.imGoing).toHaveCount(0);

    await publicPage.open(cancelled.id);
    await expect(publicPage.cancelled).toBeVisible();
    await expect(
      page.getByText('Our venue fell through. We’ll reschedule for January.'),
    ).toBeVisible();
    await expect(publicPage.imGoing).toHaveCount(0);
  });

  test('a lead copies the public link from the event page and previews it', async ({
    page,
    api,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const event = addPublicEvent(api);
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['EventLead'] });
    const eventPage = new EventPage(page);
    await api.signInAs(grace, `/events/${event.id}`);

    await expect(eventPage.publicLink).toHaveValue(new RegExp(`/public/events/${event.id}$`));
    await eventPage.copyLink.click();
    await expect(page.getByText('Link copied')).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(
      new RegExp(`/public/events/${event.id}$`),
    );

    await eventPage.previewPublicPage.click();
    await expect(page).toHaveURL(new RegExp(`/public/events/${event.id}$`));
    await expect(new PublicEventPage(page).heading).toHaveText('Toronto Builders Night');
  });
});
