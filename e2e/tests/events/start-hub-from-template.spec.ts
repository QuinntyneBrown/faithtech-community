// Traces to: L2-169 AC1, AC3, AC4, AC6, L2-171 AC3 (docs/detailed-designs/events/start-hub-from-template)
import { expect, test } from '../../fixtures/app';
import { MockApi } from '../../fixtures/mock-api';
import { CreateEventHubDialog } from '../../pages/create-event-hub.dialog';
import { EventHubPage } from '../../pages/event-hub.page';
import { EventPage } from '../../pages/event.page';

test.use({ timezoneId: 'America/Toronto' });

/** Toronto Builders Night, 6:30 pm to 9:00 pm on Fri 6 Nov 2026, and a City Lead on its event page. */
async function arrange(api: MockApi) {
  const event = api.events.add({
    title: 'Toronto Builders Night',
    startsAt: '2026-11-06T23:30:00.000Z',
    endsAt: '2026-11-07T02:00:00.000Z',
    visibility: 'Public',
  });
  const grace = api.addAccount({
    email: 'grace@example.org',
    name: 'Grace Okonkwo',
    roles: ['CityLead'],
  });
  await api.signInAs(grace, `/events/${event.id}`);
  return event;
}

test.describe('Start a hub from a template', () => {
  // L2-169 AC1, AC3, AC4: Meetup pre-ticks its sections and fills its defaults, timed from the event's start.
  test('a lead starts a hub from the Meetup template', async ({ page, api, axe }) => {
    const event = await arrange(api);
    const wizard = new CreateEventHubDialog(page);
    const hub = new EventHubPage(page);

    await new EventPage(page).createEventHub.click();
    await wizard.next.click();
    await expect(wizard.step).toHaveText(/Step 2 of 4\s*Starting point/);
    await expect(wizard.startingPoints()).toHaveText([
      /^Hackathon\s*A day of building in teams, with demos at the end\.$/,
      /^Meetup\s*An evening of talks and conversation\.$/,
      /^Workshop\s*A hands-on session with one facilitator\.$/,
      /^Blank\s*Start with empty sections and fill them in yourself\.$/,
      /^Copy a past hub\s*Bring every section over from one of your hubs, with its times moved to this event\.$/,
    ]);
    await expect(wizard.startingPoint('Blank')).toBeChecked();
    await axe.check();

    await wizard.startingPoint('Meetup').check();
    await wizard.next.click();

    await expect(wizard.step).toHaveText(/Step 3 of 4\s*Sections/);
    await expect(
      wizard.text('Ticked for Meetup. Untick anything you don’t need. You can change this later.'),
    ).toBeVisible();
    await expect(wizard.section('Submission and feedback')).not.toBeChecked();
    await expect(wizard.section('Hero')).toBeChecked();
    await expect(wizard.section('Giving')).toBeChecked();
    await axe.check();

    await wizard.next.click();
    await wizard.fillInNow.click();
    await expect(hub.heading).toHaveText('Event hub');
    const summary = await hub.summary();
    expect(summary).toContain('Hero: Ready');
    expect(summary).toContain('Agenda: Ready');
    expect(summary).toContain('Submission and feedback: Hidden');
    const agenda = api.events.hubs.section(event.id, 'Agenda')?.content['items'] as {
      startsAt: string;
      title: string;
    }[];
    expect(agenda.map((r) => [r.startsAt, r.title])).toEqual([
      ['2026-11-06T23:30:00.000Z', 'Doors open'],
      ['2026-11-07T00:00:00.000Z', 'Welcome and prayer'],
      ['2026-11-07T00:15:00.000Z', 'Talks'],
      ['2026-11-07T01:00:00.000Z', 'Conversation and connection'],
    ]);
    expect(api.events.hubs.of(event.id)?.templateKey).toBe('9a1c4e2b-6d3f-4b8a-9e10-4c5d6e7f8a02');
  });

  // L2-169 AC3: going Back and choosing Blank replaces what the template filled.
  test('choosing again after going back replaces what the template filled', async ({
    page,
    api,
  }) => {
    const event = await arrange(api);
    const wizard = new CreateEventHubDialog(page);

    await new EventPage(page).createEventHub.click();
    await wizard.next.click();
    await wizard.startingPoint('Workshop').check();
    await wizard.next.click();
    await expect(wizard.section('Giving')).not.toBeChecked();

    await wizard.back.click();
    await wizard.startingPoint('Blank').check();
    await wizard.next.click();

    await expect(wizard.step).toHaveText(/Step 3 of 4\s*Sections/);
    await expect(wizard.sections()).toHaveCount(7);
    for (const box of await wizard.sections().all()) await expect(box).toBeChecked();
    await expect(wizard.dialog.getByText(/^Ticked for/)).toHaveCount(0);
    expect(api.events.hubs.section(event.id, 'Hero')?.content).toEqual({});
    expect(api.events.hubs.of(event.id)?.templateKey).toBe('blank');
  });

  // L2-169 AC6: the templates fail to load; Blank and Copy stay, and Try again loads them.
  test('templates that fail to load can be tried again', async ({ page, api, axe }) => {
    await arrange(api);
    api.events.hubs.failNextTemplates();
    const wizard = new CreateEventHubDialog(page);

    await new EventPage(page).createEventHub.click();
    await wizard.next.click();

    await expect(wizard.alert).toContainText('We couldn’t load the templates');
    await expect(wizard.startingPoints()).toHaveCount(2);
    await axe.check();
    await wizard.tryAgain.click();
    await expect(wizard.startingPoints()).toHaveCount(5);
    await expect(wizard.alert).toHaveCount(0);
  });

  // L2-169 AC6: applying fails; the choice stays and Try again applies it.
  test('a failed start keeps the choice and Try again applies it', async ({ page, api }) => {
    const event = await arrange(api);
    const wizard = new CreateEventHubDialog(page);

    await new EventPage(page).createEventHub.click();
    await wizard.next.click();
    await wizard.startingPoint('Hackathon').check();
    api.events.hubs.failNextSave();
    await wizard.next.click();

    await expect(wizard.alert).toContainText('We couldn’t save your hub');
    await expect(wizard.startingPoint('Hackathon')).toBeChecked();
    await wizard.tryAgain.click();
    await expect(wizard.step).toHaveText(/Step 3 of 4\s*Sections/);
    expect(api.events.hubs.of(event.id)?.templateKey).toBe('9a1c4e2b-6d3f-4b8a-9e10-4c5d6e7f8a01');
  });

  // L2-171 AC3: an organisation without templates offers Blank and Copy a past hub only.
  test('an organisation without templates offers Blank and Copy a past hub', async ({
    page,
    api,
  }) => {
    await arrange(api);
    api.events.hubs.templates = [];
    const wizard = new CreateEventHubDialog(page);

    await new EventPage(page).createEventHub.click();
    await wizard.next.click();

    await expect(wizard.startingPoints()).toHaveText([/^Blank/, /^Copy a past hub/]);
  });
});
