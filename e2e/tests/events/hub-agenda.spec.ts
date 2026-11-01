// Traces to: L2-157 AC1, AC2, AC4; L2-159 AC1 to AC7 (docs/detailed-designs/events/fill-in-hub-sections)
import { expect, test } from '../../fixtures/app';
import { MockApi } from '../../fixtures/mock-api';
import { EventHubPage } from '../../pages/event-hub.page';
import { HubAgendaDialog } from '../../pages/hub-agenda.dialog';
import { HubSectionPreviewDialog } from '../../pages/hub-section-preview.dialog';

test.use({ timezoneId: 'America/Toronto' });

/** Toronto Builders Night, 6:30 pm to 9:00 pm on Fri 6 Nov 2026 in Toronto. */
function arrange(api: MockApi) {
  const event = api.events.add({
    title: 'Toronto Builders Night',
    startsAt: '2026-11-06T23:30:00.000Z',
    endsAt: '2026-11-07T02:00:00.000Z',
    format: 'InPerson',
    venue: 'Kestrel Labs, 220 King St W, Toronto',
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

test.describe('Hub sections: Agenda', () => {
  // L2-159 AC1, AC2, AC4, AC6, AC7; L2-157 AC1, AC2.
  test('a lead adds rows in time order, reorders them, reviews and saves', async ({
    page,
    api,
    axe,
  }) => {
    const { event, grace } = arrange(api);
    const hub = new EventHubPage(page);
    const agenda = new HubAgendaDialog(page);
    await api.signInAs(grace, `/events/${event.id}/hub`);

    await hub.action('Fill in', 'Agenda').click();
    await expect(agenda.step).toHaveText(/Step 1 of 2\s*Rows/);
    await expect(agenda.question).toHaveText('What’s happening and when?');
    await expect(agenda.empty).toBeVisible();
    await axe.check();

    await agenda.addRow.click();
    await expect(agenda.text('Enter a time.')).toBeVisible();
    await expect(agenda.text('Say what’s happening.')).toBeVisible();

    await agenda.time.fill('19:00');
    await agenda.what.fill('Build time');
    await agenda.addRow.click();
    await agenda.time.fill('18:30');
    await agenda.what.fill('Doors open');
    await agenda.detail.fill('Grab a coffee and find a table.');
    await agenda.addRow.click();
    expect(await agenda.summary()).toEqual(['6:30 pm Doors open', '7:00 pm Build time']);
    await expect(agenda.what).toHaveValue('');
    await axe.check();

    await agenda.moveDown('Doors open').click();
    await expect(agenda.announcement).toHaveText('Moved Doors open down to position 2 of 2.');
    expect(await agenda.summary()).toEqual(['7:00 pm Build time', '6:30 pm Doors open']);
    await agenda.moveUp('Doors open').click();

    await agenda.next.click();
    await expect(agenda.step).toHaveText(/Step 2 of 2\s*Review/);
    await expect(agenda.text('Here’s the agenda')).toBeVisible();
    await expect(agenda.review).toContainText('Doors open');
    await expect(agenda.text('2 rows, 6:30 pm to 7:00 pm')).toBeVisible();
    await axe.check();

    await agenda.save.click();
    await expect(hub.toast('Agenda saved')).toBeVisible();
    await expect(hub.row('Agenda')).toContainText('Ready');
    expect(api.events.hubs.section(event.id, 'Agenda')?.content).toEqual({
      items: [
        {
          startsAt: '2026-11-06T23:30:00.000Z',
          title: 'Doors open',
          detail: 'Grab a coffee and find a table.',
        },
        { startsAt: '2026-11-07T00:00:00.000Z', title: 'Build time', detail: null },
      ],
    });

    await hub.more('Agenda').click();
    await hub.menuItem('Preview').click();
    const preview = new HubSectionPreviewDialog(page, 'Agenda');
    await expect(preview.text('Doors open')).toBeVisible();
    await expect(preview.text('6:30 pm')).toBeVisible();
  });

  // L2-159 AC3: paste, read within the event's hours, list what it couldn't read, add once confirmed.
  test('a lead pastes a schedule and adds the rows it found', async ({ page, api, axe }) => {
    const { event, grace } = arrange(api);
    const hub = new EventHubPage(page);
    const agenda = new HubAgendaDialog(page);
    await api.signInAs(grace, `/events/${event.id}/hub`);

    await hub.action('Fill in', 'Agenda').click();
    await agenda.pasteSchedule.click();
    await agenda.schedule.fill(
      [
        '6:30 Doors open',
        '7:15 pm Lightning talks',
        '19:45 – Demos',
        'speakers to be confirmed',
        'after-party?',
      ].join('\n'),
    );
    await agenda.readSchedule.click();

    await expect(agenda.found).toHaveAccessibleName('We found 3 rows');
    await expect(agenda.found.getByRole('listitem')).toHaveText([
      '6:30 pm Doors open',
      '7:15 pm Lightning talks',
      '7:45 pm Demos',
    ]);
    await expect(
      agenda.text('We couldn’t read 2 lines: ‘speakers to be confirmed’, ‘after-party?’'),
    ).toBeVisible();
    await expect(agenda.empty).toBeVisible();
    await axe.check();

    await agenda.addTheseRows.click();
    expect(await agenda.summary()).toEqual([
      '6:30 pm Doors open',
      '7:15 pm Lightning talks',
      '7:45 pm Demos',
    ]);

    await agenda.remove('Lightning talks').click();
    await agenda.edit('Demos').click();
    await expect(agenda.what).toHaveValue('Demos');
    await agenda.what.fill('Demos and feedback');
    await agenda.addRow.click();
    expect(await agenda.summary()).toEqual(['6:30 pm Doors open', '7:45 pm Demos and feedback']);

    await agenda.saveAndFinishLater.click();
    await expect(hub.toast('Agenda saved')).toBeVisible();
    expect(api.events.hubs.section(event.id, 'Agenda')?.content['items']).toHaveLength(2);
  });

  // L2-159 AC5: a row outside the event's times is a warning, not an error.
  test('a row outside the event’s times is flagged and still saves', async ({ page, api }) => {
    const { event, grace } = arrange(api);
    api.events.hubs.fill(event.id, 'Agenda', {
      items: [
        { startsAt: '2026-11-06T23:30:00.000Z', title: 'Doors open', detail: null },
        { startsAt: '2026-11-07T02:30:00.000Z', title: 'Clean up', detail: null },
      ],
    });
    const hub = new EventHubPage(page);
    const agenda = new HubAgendaDialog(page);
    await api.signInAs(grace, `/events/${event.id}/hub`);

    await hub.action('Edit', 'Agenda').click();
    await expect(agenda.row('Clean up')).toContainText(
      'Outside the event’s times (6:30 pm to 9:00 pm)',
    );
    await expect(agenda.row('Doors open')).not.toContainText('Outside');

    await agenda.next.click();
    await agenda.save.click();
    await expect(hub.toast('Agenda saved')).toBeVisible();
  });

  // L2-157 AC4: a failed save on Next keeps the step and the rows.
  test('a failed save keeps the rows and Try again saves them', async ({ page, api }) => {
    const { event, grace } = arrange(api);
    const hub = new EventHubPage(page);
    const agenda = new HubAgendaDialog(page);
    await api.signInAs(grace, `/events/${event.id}/hub`);

    await hub.action('Fill in', 'Agenda').click();
    await agenda.time.fill('18:30');
    await agenda.what.fill('Doors open');
    await agenda.addRow.click();
    api.events.hubs.failNextSave();
    await agenda.next.click();

    await expect(agenda.failed).toBeVisible();
    await expect(agenda.step).toHaveText(/Step 1 of 2/);
    expect(await agenda.summary()).toEqual(['6:30 pm Doors open']);

    await agenda.tryAgain.click();
    await expect(agenda.step).toHaveText(/Step 2 of 2/);
  });
});
