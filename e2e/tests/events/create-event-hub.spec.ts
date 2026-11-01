// Traces to: L2-153, L2-154, L2-155, L2-169 AC1 (docs/detailed-designs/events/create-event-hub)
import { expect, test } from '../../fixtures/app';
import { MockApi } from '../../fixtures/mock-api';
import { CreateEventHubDialog } from '../../pages/create-event-hub.dialog';
import { EventHubPage } from '../../pages/event-hub.page';
import { EventPage } from '../../pages/event.page';
import { BREAKPOINTS, hasHorizontalScroll } from '../../pages/viewport';

test.use({ timezoneId: 'America/Toronto' });

function arrange(api: MockApi) {
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
  return { event, grace };
}

test.describe('Create an event hub', () => {
  // L2-153 AC1 to AC6, L2-154 AC1 and AC2.
  test('a City Lead starts a hub in four steps and lands on its checklist', async ({
    page,
    api,
    axe,
  }) => {
    const { event, grace } = arrange(api);
    const eventPage = new EventPage(page);
    const wizard = new CreateEventHubDialog(page);
    const hub = new EventHubPage(page);
    await api.signInAs(grace, `/events/${event.id}`);

    await eventPage.createEventHub.click();
    await expect(wizard.step).toHaveText(/Step 1 of 4\s*Event/);
    await expect(wizard.question).toHaveText('Which event is this hub for?');
    await expect(wizard.fact('Event')).toHaveText('Toronto Builders Night');
    await expect(wizard.fact('Where')).toHaveText('Kestrel Labs, 220 King St W, Toronto');
    await expect(wizard.fact('RSVP link')).toContainText(`/public/events/${event.id}`);
    await expect(wizard.back).toHaveCount(0);
    await expect(wizard.saveLater).toBeVisible();
    await axe.check();

    await wizard.next.click();
    await expect(wizard.step).toHaveText(/Step 2 of 4\s*Starting point/);
    expect(api.events.hubs.of(event.id)?.status).toBe('Draft');
    await expect(wizard.startingPoint('Blank')).toBeChecked();
    // L2-153 AC4 as changed by L2-169: the organisation's templates and Copy a past hub are offered beside Blank.
    for (const choice of ['Hackathon', 'Meetup', 'Workshop', 'Copy a past hub']) {
      await expect(wizard.startingPoint(choice)).toBeEnabled();
    }
    await axe.check();

    await wizard.next.click();
    await expect(wizard.step).toHaveText(/Step 3 of 4\s*Sections/);
    await expect(wizard.sections()).toHaveCount(7);
    await wizard.section('Giving').uncheck();
    await axe.check();

    await wizard.next.click();
    await expect(wizard.step).toHaveText(/Step 4 of 4\s*Done/);
    await expect(wizard.question).toHaveText('Your hub is ready to fill in');
    expect(api.events.hubs.of(event.id)?.sections.find((s) => s.kind === 'Giving')?.visible).toBe(
      false,
    );
    await axe.check();

    await wizard.fillInNow.click();
    await expect(page).toHaveURL(new RegExp(`/events/${event.id}/hub$`));
    await expect(hub.heading).toHaveText('Event hub');
    await expect(hub.status).toHaveText('Draft');
    await expect(hub.link).toHaveValue(new RegExp(`/public/events/${event.id}/hub$`));
    await expect(page.getByText('3 of 6 sections ready')).toBeVisible();
    await expect(hub.rows).toHaveCount(7);
    expect(await hub.summary()).toEqual([
      'Hero: Ready',
      'Agenda: Needs info',
      'Venue: Ready',
      'People: Needs info',
      'Submission and feedback: Needs info',
      'Giving: Hidden',
      'Upcoming events: Ready',
    ]);
    await axe.check();

    await eventPage.open(event.id);
    await expect(eventPage.openEventHub).toBeVisible();
    await expect(eventPage.createEventHub).toHaveCount(0);
  });

  // L2-153 AC7.
  test('Save and finish later on the first step keeps a draft and the event offers Open event hub', async ({
    page,
    api,
  }) => {
    const { event, grace } = arrange(api);
    const eventPage = new EventPage(page);
    const wizard = new CreateEventHubDialog(page);
    await api.signInAs(grace, `/events/${event.id}`);

    await eventPage.createEventHub.click();
    await wizard.saveLater.click();

    await expect(wizard.dialog).toHaveCount(0);
    await expect(page.getByText('Hub saved as a draft')).toBeVisible();
    expect(api.events.hubs.of(event.id)?.status).toBe('Draft');
    await expect(eventPage.openEventHub).toBeVisible();
  });

  // L2-153 AC8.
  test('a failed save keeps the step and Try again saves it', async ({ page, api, axe }) => {
    const { event, grace } = arrange(api);
    const eventPage = new EventPage(page);
    const wizard = new CreateEventHubDialog(page);
    await api.signInAs(grace, `/events/${event.id}`);
    await eventPage.createEventHub.click();
    await wizard.next.click();
    await wizard.next.click();
    await wizard.section('People').uncheck();

    api.events.hubs.failNextSave();
    await wizard.next.click();

    await expect(wizard.alert).toContainText('We couldn’t save your hub');
    await expect(wizard.step).toHaveText(/Step 3 of 4/);
    await expect(wizard.section('People')).not.toBeChecked();
    await axe.check();

    await wizard.tryAgain.click();
    await expect(wizard.step).toHaveText(/Step 4 of 4/);
    expect(api.events.hubs.of(event.id)?.sections.find((s) => s.kind === 'People')?.visible).toBe(
      false,
    );
  });

  // L2-153 AC8, AC9: the server's refusal is shown on the step.
  test('an event that gained a hub meanwhile says so on the step', async ({ page, api }) => {
    const { event, grace } = arrange(api);
    const eventPage = new EventPage(page);
    const wizard = new CreateEventHubDialog(page);
    await api.signInAs(grace, `/events/${event.id}`);
    await eventPage.createEventHub.click();

    api.events.hubs.add(event);
    await wizard.next.click();

    await expect(wizard.alert).toHaveText('This event already has a hub.');
    await expect(wizard.step).toHaveText(/Step 1 of 4/);
  });

  // L2-153 AC1, L2-154 AC4, L2-155 AC2.
  test('a member without ManageEventHubs sees no Create event hub and cannot open a hub', async ({
    page,
    api,
    axe,
  }) => {
    const { event } = arrange(api);
    api.events.hubs.add(event);
    const ruth = api.addAccount({
      email: 'ruth@example.org',
      name: 'Ruth Alvarez',
      capabilities: ['ManageEvents'],
    });
    const eventPage = new EventPage(page);
    const hub = new EventHubPage(page);
    await api.signInAs(ruth, `/events/${event.id}`);

    await expect(eventPage.heading).toHaveText('Toronto Builders Night');
    await expect(eventPage.createEventHub).toHaveCount(0);
    await expect(eventPage.openEventHub).toHaveCount(0);

    await hub.open(event.id);
    await expect(hub.forbidden).toBeVisible();
    await axe.check();
  });

  // L2-154 AC4.
  test('an event without a hub says so on the hub home', async ({ page, api, axe }) => {
    const { event, grace } = arrange(api);
    const hub = new EventHubPage(page);
    await api.signInAs(grace, `/events/${event.id}/hub`);

    await expect(hub.noHub).toBeVisible();
    await expect(hub.backToEvent).toHaveAttribute('href', `/events/${event.id}`);
    await axe.check();
  });

  // L2-153 AC10.
  test('the wizard and the hub home fit a phone', async ({ page, api }) => {
    await page.setViewportSize(BREAKPOINTS.xs);
    const { event, grace } = arrange(api);
    const eventPage = new EventPage(page);
    const wizard = new CreateEventHubDialog(page);
    await api.signInAs(grace, `/events/${event.id}`);

    await eventPage.createEventHub.click();
    for (const step of [1, 2, 3, 4]) {
      await expect(wizard.step).toHaveText(new RegExp(`Step ${step} of 4`));
      expect(await hasHorizontalScroll(page), `step ${step}`).toBe(false);
      if (step < 4) await wizard.next.click();
    }
    await wizard.fillInNow.click();
    await expect(page.getByText('4 of 7 sections ready')).toBeVisible();
    expect(await hasHorizontalScroll(page), 'hub home').toBe(false);
  });
});
