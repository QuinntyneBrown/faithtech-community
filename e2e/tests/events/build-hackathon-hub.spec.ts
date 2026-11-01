// Traces to: L2-172 AC1, AC2, L2-183 AC1, AC2 (docs/detailed-designs/events/build-hackathon-hub)
import { expect, test } from '../../fixtures/app';
import { MockApi } from '../../fixtures/mock-api';
import { CreateEventHubDialog } from '../../pages/create-event-hub.dialog';
import { EventHubPage } from '../../pages/event-hub.page';
import { EventPage } from '../../pages/event.page';

test.use({ timezoneId: 'America/Los_Angeles' });

const CATALOGUE = [
  'Hero',
  'Agenda',
  'Venue',
  'Parking',
  'What to bring',
  'Partners',
  'Tracks',
  'Process',
  'Rules',
  'People',
  'Submission and feedback',
  'Demo format',
  'Judging and honors',
  'Worship',
  'Slides',
  'Giving',
  'Upcoming events',
];

/** SoCal Hackathon on Sat 24 Oct 2026, 9:00 am to 6:00 pm, and a City Lead on its event page. */
async function arrange(api: MockApi) {
  const event = api.events.add({
    title: 'SoCal Hackathon',
    startsAt: '2026-10-24T16:00:00.000Z',
    endsAt: '2026-10-25T01:00:00.000Z',
    visibility: 'Public',
    venue: 'Grace Church, 5100 Ocean Blvd, Long Beach',
  });
  const grace = api.addAccount({
    email: 'grace@example.org',
    name: 'Grace Okonkwo',
    roles: ['CityLead'],
  });
  await api.signInAs(grace, `/events/${event.id}`);
  return event;
}

test.describe('Build a hackathon hub', () => {
  // L2-172 AC2, L2-183 AC1, AC2: Hackathon brings every section; its defaults are ready, the event's own need info.
  test('a lead starts from Hackathon and gets every section in catalogue order', async ({
    page,
    api,
    axe,
  }) => {
    await arrange(api);
    const wizard = new CreateEventHubDialog(page);
    const hub = new EventHubPage(page);

    await new EventPage(page).createEventHub.click();
    await wizard.next.click();
    await wizard.startingPoint('Hackathon').check();
    await wizard.next.click();

    await expect(wizard.step).toHaveText(/Step 3 of 4\s*Sections/);
    await expect(wizard.sections()).toHaveCount(17);
    for (const title of CATALOGUE) await expect(wizard.section(title)).toBeChecked();
    await expect(
      wizard.text('Where to park, with a map and notes for each option.'),
    ).toBeVisible();
    await axe.check();

    await wizard.next.click();
    await wizard.fillInNow.click();
    await expect(hub.heading).toHaveText('Event hub');
    expect(await hub.titles()).toEqual(CATALOGUE);
    const summary = await hub.summary();
    for (const ready of ['What to bring', 'Process', 'Rules', 'Demo format', 'Judging and honors'])
      expect(summary).toContain(`${ready}: Ready`);
    for (const needs of ['Parking', 'Partners', 'Tracks', 'Worship', 'Slides'])
      expect(summary).toContain(`${needs}: Needs info`);
    await expect(hub.line('Parking')).toHaveText('Add a parking option.');
    await expect(hub.line('Judging and honors')).toHaveText(
      'How judges score, and the honors teams can win.',
    );
    await axe.check();
  });

  // L2-172 AC2: Blank keeps the seven core sections.
  test('a hub from Blank lists only the core sections', async ({ page, api }) => {
    const event = await arrange(api);
    api.events.hubs.add(event);
    const hub = new EventHubPage(page);

    await hub.open(event.id);
    await expect(hub.rows).toHaveCount(7);

    expect(await hub.titles()).toEqual([
      'Hero',
      'Agenda',
      'Venue',
      'People',
      'Submission and feedback',
      'Giving',
      'Upcoming events',
    ]);
  });
});
