// Traces to: L2-156 AC1 to AC4, AC6 (docs/detailed-designs/events/fill-in-hub-sections)
import { expect, test } from '../../fixtures/app';
import { MockApi } from '../../fixtures/mock-api';
import { EventHubPage } from '../../pages/event-hub.page';
import { ReorderHubSectionsDialog } from '../../pages/reorder-hub-sections.dialog';

test.use({ timezoneId: 'America/Toronto' });

function arrange(api: MockApi) {
  const event = api.events.add({
    title: 'Toronto Builders Night',
    startsAt: '2026-11-06T23:30:00.000Z',
    endsAt: '2026-11-07T02:00:00.000Z',
    format: 'InPerson',
    venue: 'Centre for Social Innovation, 192 Spadina Ave',
    visibility: 'Public',
  });
  api.events.hubs.add(event);
  const grace = api.addAccount({
    email: 'grace@example.org',
    name: 'Grace Okonkwo',
    roles: ['CityLead'],
  });
  return { event, grace };
}

test.describe('Hub sections checklist', () => {
  // L2-156 AC2: each row's state, and a Needs info row says what is missing.
  test('each row says whether it is ready and what is missing', async ({ page, api, axe }) => {
    const { event, grace } = arrange(api);
    const hub = new EventHubPage(page);
    await api.signInAs(grace, `/events/${event.id}/hub`);

    await expect(hub.progress).toHaveAccessibleName('4 of 7 sections ready');
    expect(await hub.summary()).toEqual([
      'Hero: Ready',
      'Agenda: Needs info',
      'Venue: Ready',
      'People: Needs info',
      'Submission and feedback: Needs info',
      'Giving: Ready',
      'Upcoming events: Ready',
    ]);
    await expect(hub.line('Agenda')).toHaveText('Add the day’s schedule.');
    await expect(hub.line('People')).toHaveText('Add mentors, judges or speakers.');
    await expect(hub.line('Submission and feedback')).toHaveText(
      'Add a submission or feedback link.',
    );
    await expect(hub.line('Giving')).toHaveText(
      'How to give, from your organisation’s giving link.',
    );
    await axe.check();
  });

  // L2-156 AC2: Giving needs the organisation's giving link.
  test('Giving needs info until the organisation has a giving link', async ({ page, api }) => {
    const { event, grace } = arrange(api);
    api.host.organisation = { ...api.host.organisation, givingLink: null, givingText: null };
    const hub = new EventHubPage(page);
    await api.signInAs(grace, `/events/${event.id}/hub`);

    await expect(hub.row('Giving')).toContainText('Needs info');
    await expect(hub.line('Giving')).toHaveText(
      'Add your organisation’s giving link in Organisation settings.',
    );
  });

  // L2-156 AC1, AC3: Hide section and Show keep the content and update the row and the progress line.
  test('a lead hides Giving from its menu and shows it again', async ({ page, api, axe }) => {
    const { event, grace } = arrange(api);
    const hub = new EventHubPage(page);
    await api.signInAs(grace, `/events/${event.id}/hub`);

    await hub.more('Giving').click();
    await hub.menuItem('Hide section').click();

    await expect(hub.toast('Giving hidden')).toContainText('Visitors won’t see it.');
    await expect(hub.row('Giving')).toContainText('Hidden');
    await expect(hub.more('Giving')).toHaveCount(0);
    await expect(hub.progress).toHaveAccessibleName('3 of 6 sections ready');
    expect(api.events.hubs.section(event.id, 'Giving')?.visible).toBe(false);
    await axe.check();

    await page.reload();
    await expect(hub.row('Giving')).toContainText('Hidden');

    await hub.action('Show', 'Giving').click();
    await expect(hub.toast('Giving shown')).toBeVisible();
    await expect(hub.row('Giving')).toContainText('Ready');
    await expect(hub.progress).toHaveAccessibleName('4 of 7 sections ready');
  });

  // L2-156 AC6: a failed visibility change changes nothing.
  test('a failed hide leaves the section shown and says so', async ({ page, api }) => {
    const { event, grace } = arrange(api);
    const hub = new EventHubPage(page);
    await api.signInAs(grace, `/events/${event.id}/hub`);

    api.events.hubs.failNextSave();
    await hub.more('Giving').click();
    await hub.menuItem('Hide section').click();

    await expect(hub.toast('We couldn’t hide Giving')).toBeVisible();
    await expect(hub.row('Giving')).toContainText('Ready');
    expect(api.events.hubs.section(event.id, 'Giving')?.visible).toBe(true);
  });

  // L2-156 AC4: Reorder sections, announced moves, Save and the toast.
  test('a lead moves Agenda below Venue and saves the order', async ({ page, api, axe }) => {
    const { event, grace } = arrange(api);
    const hub = new EventHubPage(page);
    const reorder = new ReorderHubSectionsDialog(page);
    await api.signInAs(grace, `/events/${event.id}/hub`);

    await hub.reorder.click();
    await expect(reorder.heading).toBeVisible();
    await expect(reorder.rows).toHaveCount(7);
    await expect(reorder.moveUp('Hero')).toBeDisabled();
    await axe.check();

    await reorder.moveDown('Agenda').click();
    await expect(reorder.announcement).toHaveText('Moved Agenda down to position 3 of 7.');
    await reorder.save.click();

    await expect(hub.toast('Sections reordered')).toBeVisible();
    await expect(reorder.dialog).toHaveCount(0);
    expect(await hub.titles()).toEqual([
      'Hero',
      'Venue',
      'Agenda',
      'People',
      'Submission and feedback',
      'Giving',
      'Upcoming events',
    ]);
    expect(api.events.hubs.of(event.id)?.sections.map((s) => s.kind)).toEqual([
      'Hero',
      'Venue',
      'Agenda',
      'People',
      'Links',
      'Giving',
      'UpcomingEvents',
    ]);
  });

  // L2-156 AC6: a failed reorder keeps the dialog and the new order, and Try again saves it.
  test('a failed reorder keeps the order and Try again saves it', async ({ page, api, axe }) => {
    const { event, grace } = arrange(api);
    const hub = new EventHubPage(page);
    const reorder = new ReorderHubSectionsDialog(page);
    await api.signInAs(grace, `/events/${event.id}/hub`);

    await hub.reorder.click();
    await reorder.moveDown('Agenda').click();
    api.events.hubs.failNextSave();
    await reorder.save.click();

    await expect(reorder.failed).toBeVisible();
    await expect(reorder.rows.nth(2)).toContainText('Agenda');
    expect(api.events.hubs.of(event.id)?.sections[1].kind).toBe('Agenda');
    await axe.check();

    await reorder.tryAgain.click();
    await expect(hub.toast('Sections reordered')).toBeVisible();
    expect(api.events.hubs.of(event.id)?.sections[1].kind).toBe('Venue');
  });
});
