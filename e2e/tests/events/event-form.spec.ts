// Traces to: L2-020 (docs/detailed-designs/events/create-and-edit-events)
import { expect, test } from '../../fixtures/app';
import { EventFormPage } from '../../pages/event-form.page';
import { EventsPage } from '../../pages/events.page';

test.use({ timezoneId: 'America/Toronto' });

const builders = {
  title: 'Toronto Builders Night',
  type: 'Builders night',
  description: 'An evening for Christians who build.',
  starts: '2026-11-06T18:30',
  ends: '2026-11-06T21:00',
  city: 'Toronto',
  venue: 'Kestrel Labs, 220 King St W',
  capacity: '60',
};

test.describe('Create and edit events', () => {
  test('an Event Lead publishes an event with every field and finds it on the list', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['EventLead'] });
    const form = new EventFormPage(page);
    await api.signInAs(grace, '/events/new');

    await expect(form.heading).toHaveText('New event');
    await axe.check();
    await form.fill({ ...builders, visibility: 'Members only' });
    await form.publish.click();

    await expect(page).toHaveURL(/\/events\/event-1$/);
    const saved = api.events.events[0];
    expect(saved).toMatchObject({
      title: 'Toronto Builders Night',
      description: 'An evening for Christians who build.',
      type: 'BuildersNight',
      startsAt: '2026-11-06T23:30:00.000Z',
      endsAt: '2026-11-07T02:00:00.000Z',
      city: 'Toronto',
      format: 'InPerson',
      venue: 'Kestrel Labs, 220 King St W',
      onlineLink: null,
      capacity: 60,
      visibility: 'MembersOnly',
      createdById: grace.profileId,
    });

    const events = new EventsPage(page);
    await events.open();
    await expect(events.event('Toronto Builders Night')).toContainText('Members only');
  });

  test('an online event takes a joining link instead of a venue', async ({ page, api }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const form = new EventFormPage(page);
    await api.signInAs(grace, '/events/new');

    await form.fill({ ...builders, venue: undefined, format: 'Online', capacity: '' });
    await expect(form.venue).toHaveCount(0);
    await form.link.fill('https://meet.example.org/ft');
    await form.publish.click();

    await expect(page).toHaveURL(/\/events\/event-1$/);
    expect(api.events.events[0]).toMatchObject({
      format: 'Online',
      venue: null,
      onlineLink: 'https://meet.example.org/ft',
      capacity: null,
    });
  });

  test('an end before the start and a missing venue or link show inline errors', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['EventLead'] });
    const form = new EventFormPage(page);
    await api.signInAs(grace, '/events/new');

    await form.fill({ ...builders, title: '', ends: '2026-11-06T17:00', venue: '' });
    await form.publish.click();

    await expect(form.summary).toContainText('Fix 3 things to publish');
    await expect(form.summary).toBeFocused();
    expect(await form.error(form.title)).toContain('Give the event a title people will recognise.');
    expect(await form.error(form.ends)).toContain('The end time must be after the start time.');
    expect(await form.error(form.venue)).toContain('Enter a venue address, or choose Online.');
    await axe.check();

    await form.format('Online').check();
    await form.publish.click();
    expect(await form.error(form.link)).toContain('Enter the joining link, or choose In person.');
    expect(api.callsTo('POST', '/api/events')).toHaveLength(0);
  });

  test('a lead edits an event and the members who RSVP’d are notified', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['EventLead'] });
    const event = api.events.add({
      title: 'Toronto Builders Night',
      startsAt: '2026-11-06T23:30:00.000Z',
      endsAt: '2026-11-07T02:00:00.000Z',
      capacity: 60,
      visibility: 'Public',
    });
    api.events.addRsvps(event, 2);
    const form = new EventFormPage(page);
    await api.signInAs(grace, `/events/${event.id}/edit`);

    await expect(form.heading).toHaveText('Edit event');
    await expect(form.title).toHaveValue('Toronto Builders Night');
    await expect(form.starts).toHaveValue('2026-11-06T18:30');
    await expect(form.visibility('Public')).toBeChecked();
    await axe.check();
    await page.emulateMedia({ colorScheme: 'dark' });
    await axe.check();

    await form.fill({ venue: 'Trinity Community Centre' });
    await form.saveChanges.click();

    await expect(page).toHaveURL(new RegExp(`/events/${event.id}$`));
    expect(event).toMatchObject({ venue: 'Trinity Community Centre', sequence: 1 });
    expect(api.events.notifications).toHaveLength(2);
    expect(api.events.notifications[0]).toMatchObject({
      kind: 'EventChanged',
      linkPath: `/events/${event.id}`,
    });
  });

  test('the edit form shows an error with Try again when the event cannot load', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['EventLead'] });
    const event = api.events.add({ title: 'Toronto Builders Night' });
    let fail = true;
    api.on('GET', `/api/events/${event.id}`, (route) =>
      fail ? route.fulfill({ status: 503 }) : api.fallback(route),
    );
    const form = new EventFormPage(page);
    await api.signInAs(grace, `/events/${event.id}/edit`);

    await expect(form.loadError).toBeVisible();
    await axe.check();
    fail = false;
    await form.tryAgain.click();
    await expect(form.title).toHaveValue('Toronto Builders Night');
  });

  test('a member without an event role is refused by the server', async ({ page, api }) => {
    const leah = api.addAccount({ email: 'leah@example.org', roles: ['Volunteer'] });
    const form = new EventFormPage(page);
    await api.signInAs(leah, '/events/new');

    await form.fill(builders);
    await form.publish.click();

    await expect(page).toHaveURL(/\/forbidden/);
    expect(api.events.events).toHaveLength(0);
  });
});
