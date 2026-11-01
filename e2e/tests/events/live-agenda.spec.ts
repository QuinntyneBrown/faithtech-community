// Traces to: L2-168 AC1 to AC3, AC6 (docs/detailed-designs/events/visit-event-hub)
import { expect, test } from '../../fixtures/app';
import { MockApi } from '../../fixtures/mock-api';
import { EventHubPage } from '../../pages/event-hub.page';
import { HubPage } from '../../pages/hub.page';
import { HubSectionPreviewDialog } from '../../pages/hub-section-preview.dialog';

test.use({ timezoneId: 'America/Toronto' });

/** Toronto Builders Night, 6:30 pm to 9:00 pm on Fri 6 Nov 2026 in Toronto, published, with three agenda rows. */
function arrange(api: MockApi) {
  const event = api.events.add({
    title: 'Toronto Builders Night',
    startsAt: '2026-11-06T23:30:00.000Z',
    endsAt: '2026-11-07T02:00:00.000Z',
    venue: 'Kestrel Labs, 220 King St W, Toronto',
    visibility: 'Public',
  });
  api.events.hubs.add(event);
  api.events.hubs.fill(event.id, 'Agenda', {
    items: [
      {
        startsAt: '2026-11-06T23:30:00.000Z',
        title: 'Doors open',
        detail: 'Grab a coffee and find a table.',
      },
      { startsAt: '2026-11-07T00:00:00.000Z', title: 'Build time', detail: null },
      { startsAt: '2026-11-07T01:00:00.000Z', title: 'Code freeze', detail: null },
    ],
  });
  api.events.hubs.publish(event.id);
  return event;
}

test.describe('The live agenda', () => {
  // L2-168 AC1: during the event, earlier rows are finished, the row in progress is highlighted and the next is up next.
  test('during the event the agenda shows what is happening now and up next', async ({
    page,
    api,
    axe,
  }) => {
    const event = arrange(api);
    const hub = new HubPage(page);
    await api.startBrowserClock('2026-11-07T00:30:00.000Z'); // 7:30 pm

    await hub.open(event.id);

    await expect(hub.agendaRow('Doors open')).toContainText('Finished');
    await expect(hub.agendaRow('Build time')).toContainText('Happening now');
    await expect(hub.agendaRow('Code freeze')).toContainText('Up next');
    await expect(hub.currentAgendaRow).toHaveCount(1);
    await expect(hub.currentAgendaRow).toContainText('Build time');
    await expect(hub.agendaAnnouncement).toHaveText('');
    await axe.check();
  });

  // L2-168 AC2: before the start the first row is up next and nothing is highlighted.
  test('before the event the first row is up next', async ({ page, api }) => {
    const event = arrange(api);
    const hub = new HubPage(page);
    await api.startBrowserClock('2026-11-06T23:00:00.000Z'); // 6:00 pm

    await hub.open(event.id);

    await expect(hub.agendaRow('Doors open')).toContainText('Up next');
    await expect(hub.currentAgendaRow).toHaveCount(0);
    await expect(hub.main.getByText('Happening now')).toBeHidden();
  });

  // L2-168 AC2: after the last row ends every row is finished and the agenda says so.
  test('after the event every row is finished', async ({ page, api, axe }) => {
    const event = arrange(api);
    const hub = new HubPage(page);
    await api.startBrowserClock('2026-11-07T02:20:00.000Z'); // 9:20 pm

    await hub.open(event.id);

    await expect(hub.agendaFinished).toBeVisible();
    await expect(hub.agendaRows.filter({ hasText: 'Finished' })).toHaveCount(3);
    await expect(hub.currentAgendaRow).toHaveCount(0);
    await axe.check();
  });

  // L2-168 AC3: with the page open, the states move on within 30 seconds and the change is announced once.
  test('the agenda moves on as time passes and announces the change', async ({ page, api }) => {
    const event = arrange(api);
    const hub = new HubPage(page);
    await api.startBrowserClock('2026-11-07T00:59:50.000Z'); // 7:59:50 pm

    await hub.open(event.id);
    await expect(hub.currentAgendaRow).toContainText('Build time');

    await api.advanceBrowserClock(30_000);
    await expect(hub.currentAgendaRow).toContainText('Code freeze');
    await expect(hub.agendaAnnouncement).toHaveText('Happening now: Code freeze');

    await api.advanceBrowserClock(60 * 60_000);
    await expect(hub.agendaFinished).toBeVisible();
    await expect(hub.agendaAnnouncement).toHaveText('This event has finished.');
  });

  // L2-168 AC6: the section preview on the hub home shows no live states.
  test('the section preview shows the agenda without live states', async ({ page, api }) => {
    const event = arrange(api);
    const grace = api.addAccount({
      email: 'grace@example.org',
      name: 'Grace Okonkwo',
      roles: ['CityLead'],
    });
    const hub = new EventHubPage(page);
    await api.startBrowserClock('2026-11-07T00:30:00.000Z');
    await api.signInAs(grace, `/events/${event.id}/hub`);

    await hub.more('Agenda').click();
    await hub.menuItem('Preview').click();
    const preview = new HubSectionPreviewDialog(page, 'Agenda');

    await expect(preview.text('Build time')).toBeVisible();
    await expect(preview.text('Happening now')).toBeHidden();
    await expect(preview.text('Up next')).toBeHidden();
  });
});
