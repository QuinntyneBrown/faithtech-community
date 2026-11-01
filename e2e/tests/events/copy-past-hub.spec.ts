// Traces to: L2-170 AC1 to AC6 (docs/detailed-designs/events/start-hub-from-template)
import { expect, test } from '../../fixtures/app';
import { MockApi } from '../../fixtures/mock-api';
import { CreateEventHubDialog } from '../../pages/create-event-hub.dialog';
import { EventPage } from '../../pages/event.page';

test.use({ timezoneId: 'America/Toronto' });

/** Toronto Builders Night on Fri 6 Nov 2026, past hubs to copy, and a City Lead on the event page. */
async function arrange(api: MockApi, { pastHubs = true } = {}) {
  const event = api.events.add({
    title: 'Toronto Builders Night',
    startsAt: '2026-11-06T23:30:00.000Z',
    endsAt: '2026-11-07T02:00:00.000Z',
    visibility: 'Public',
  });
  let socal;
  if (pastHubs) {
    api.events.hubs.add(
      api.events.add({
        title: 'Hackathon: Tech for Shelters',
        startsAt: '2026-11-14T14:00:00.000Z',
        endsAt: '2026-11-14T23:00:00.000Z',
      }),
    );
    socal = api.events.add({
      title: 'SoCal Hackathon',
      startsAt: '2026-10-24T16:00:00.000Z',
      endsAt: '2026-10-25T01:00:00.000Z',
    });
    api.events.hubs.add(socal, ['Giving']);
    api.events.hubs.fill(socal.id, 'Agenda', {
      items: [
        { startsAt: '2026-10-24T16:00:00.000Z', title: 'Check-in', detail: null },
        { startsAt: '2026-10-25T00:00:00.000Z', title: 'Code freeze', detail: null },
      ],
    });
    api.events.hubs.fill(socal.id, 'Links', {
      submissionUrl: 'https://forms.example.org/submit',
      feedbackUrl: null,
      codeFreezeAt: '2026-10-25T00:00:00.000Z',
    });
  }
  const grace = api.addAccount({
    email: 'grace@example.org',
    name: 'Grace Okonkwo',
    roles: ['CityLead'],
  });
  await api.signInAs(grace, `/events/${event.id}`);
  return { event, socal };
}

test.describe('Copy a past hub', () => {
  // L2-170 AC1 to AC4: search the organisation's hubs, pick one, and every section comes over with its times moved.
  test('a lead copies a past hub and its times move to the new event', async ({
    page,
    api,
    axe,
  }) => {
    const { event } = await arrange(api);
    const wizard = new CreateEventHubDialog(page);

    await new EventPage(page).createEventHub.click();
    await wizard.next.click();
    await wizard.startingPoint('Copy a past hub').check();

    await expect(wizard.pastHubs()).toHaveText([
      /^Hackathon: Tech for Shelters\s*Sat 14 Nov 2026$/,
      /^SoCal Hackathon\s*Sat 24 Oct 2026$/,
    ]);
    await axe.check();

    await wizard.searchPastHubs.fill('socal');
    await expect(wizard.pastHubs()).toHaveText([/^SoCal Hackathon/]);
    await wizard.pastHub('SoCal Hackathon').check();
    await wizard.next.click();

    await expect(wizard.step).toHaveText(/Step 3 of 4\s*Sections/);
    await expect(
      wizard.text(
        'Ticked for the hub you copied. Untick anything you don’t need. You can change this later.',
      ),
    ).toBeVisible();
    await expect(wizard.section('Giving')).not.toBeChecked();
    await expect(wizard.section('Agenda')).toBeChecked();
    await axe.check();

    // 13 days, 7 hours and 30 minutes later.
    const agenda = api.events.hubs.section(event.id, 'Agenda')?.content['items'] as {
      startsAt: string;
      title: string;
    }[];
    expect(agenda.map((r) => [r.startsAt, r.title])).toEqual([
      ['2026-11-06T23:30:00.000Z', 'Check-in'],
      ['2026-11-07T07:30:00.000Z', 'Code freeze'],
    ]);
    expect(api.events.hubs.section(event.id, 'Links')?.content['codeFreezeAt']).toBe(
      '2026-11-07T07:30:00.000Z',
    );
    expect(api.events.hubs.of(event.id)?.templateKey).toBe('copy');
    expect(api.events.hubs.of(event.id)?.status).toBe('Draft');
  });

  // L2-170 AC5: Next with no hub chosen.
  test('Next without a hub chosen asks for one', async ({ page, api, axe }) => {
    await arrange(api);
    const wizard = new CreateEventHubDialog(page);

    await new EventPage(page).createEventHub.click();
    await wizard.next.click();
    await wizard.startingPoint('Copy a past hub').check();
    await expect(wizard.pastHubs()).toHaveCount(2);
    await wizard.next.click();

    await expect(wizard.text('Choose a hub to copy.')).toBeVisible();
    await expect(wizard.step).toHaveText(/Step 2 of 4\s*Starting point/);
    await axe.check();
  });

  // L2-170 AC2: a search with no matches, and an organisation with no other hubs.
  test('a search with no matches and no hubs at all say so', async ({ page, api, axe }) => {
    await arrange(api);
    const wizard = new CreateEventHubDialog(page);

    await new EventPage(page).createEventHub.click();
    await wizard.next.click();
    await wizard.startingPoint('Copy a past hub').check();
    await wizard.searchPastHubs.fill('retreat');

    await expect(wizard.text('No hubs match “retreat”.')).toBeVisible();
    await expect(wizard.pastHubs()).toHaveCount(0);
    await axe.check();
  });

  test('an organisation with no other hubs says there are none to copy', async ({ page, api }) => {
    await arrange(api, { pastHubs: false });
    const wizard = new CreateEventHubDialog(page);

    await new EventPage(page).createEventHub.click();
    await wizard.next.click();
    await wizard.startingPoint('Copy a past hub').check();

    await expect(wizard.text('There are no other hubs to copy yet.')).toBeVisible();
    await expect(wizard.searchPastHubs).toHaveCount(0);
  });

  // L2-170 AC6: the list fails to load; Try again loads it.
  test('past hubs that fail to load can be tried again', async ({ page, api, axe }) => {
    await arrange(api);
    api.events.hubs.failNextPastHubs();
    const wizard = new CreateEventHubDialog(page);

    await new EventPage(page).createEventHub.click();
    await wizard.next.click();
    await wizard.startingPoint('Copy a past hub').check();

    await expect(wizard.alert).toContainText('We couldn’t load your hubs');
    await axe.check();
    await wizard.tryAgain.click();
    await expect(wizard.pastHubs()).toHaveCount(2);
  });
});
