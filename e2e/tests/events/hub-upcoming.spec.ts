// Traces to: L2-157 AC2, L2-162 AC1, AC2 (docs/detailed-designs/events/fill-in-hub-sections)
import { expect, test } from '../../fixtures/app';
import { MockApi } from '../../fixtures/mock-api';
import { EventHubPage } from '../../pages/event-hub.page';
import { HubSectionPreviewDialog } from '../../pages/hub-section-preview.dialog';
import { HubSectionDialog } from '../../pages/hub-section.dialog';

function arrange(api: MockApi) {
  const event = api.events.add({ title: 'Toronto Builders Night', visibility: 'Public' }, 5);
  api.events.hubs.add(event);
  const grace = api.addAccount({
    email: 'grace@example.org',
    name: 'Grace Okonkwo',
    roles: ['CityLead'],
  });
  return { event, grace };
}

test.describe('Hub sections: Upcoming events', () => {
  // L2-162 AC1, AC2; L2-157 AC2.
  test('a lead chooses how many upcoming events to show and previews them', async ({
    page,
    api,
    axe,
  }) => {
    const { event, grace } = arrange(api);
    api.events.add({ title: 'Prayer and Code Breakfast', visibility: 'Public' }, 20);
    api.events.add({ title: 'Hackathon: Tech for Shelters', visibility: 'Public' }, 13);
    api.events.add({ title: 'Leads only planning', visibility: 'MembersOnly' }, 10);
    api.events.add({ title: 'Called off', visibility: 'Public', isCancelled: true }, 11);
    api.events.add({ title: 'Last month’s night', visibility: 'Public' }, -3);
    api.events.add({ title: 'Toronto Builders Night: Advent', visibility: 'Public' }, 33);
    api.events.add({ title: 'Winter retreat', visibility: 'Public' }, 40);
    const hub = new EventHubPage(page);
    const upcoming = new HubSectionDialog(page, 'Upcoming events');
    await api.signInAs(grace, `/events/${event.id}/hub`);

    await hub.action('Edit', 'Upcoming events').click();
    await expect(upcoming.question).toHaveText('How many upcoming events should the hub show?');
    await expect(upcoming.select('Show')).toHaveValue('3');
    const now = upcoming.dialog.getByRole('list', { name: 'The hub would show these now' });
    await expect(now.getByRole('link')).toHaveText([
      'Hackathon: Tech for Shelters',
      'Prayer and Code Breakfast',
      'Toronto Builders Night: Advent',
    ]);
    await axe.check();

    await upcoming.select('Show').selectOption('2');
    await expect(now.getByRole('link')).toHaveText([
      'Hackathon: Tech for Shelters',
      'Prayer and Code Breakfast',
    ]);
    await upcoming.save.click();
    await expect(hub.toast('Upcoming events saved')).toBeVisible();
    expect(api.events.hubs.section(event.id, 'UpcomingEvents')?.content).toEqual({ count: 2 });

    await hub.more('Upcoming events').click();
    await hub.menuItem('Preview').click();
    const preview = new HubSectionPreviewDialog(page, 'Upcoming events');
    await expect(
      preview.dialog.getByRole('list', { name: 'Upcoming events' }).getByRole('link'),
    ).toHaveText(['Hackathon: Tech for Shelters', 'Prayer and Code Breakfast']);
  });

  // L2-162 AC2: with none, the hub says they will appear.
  test('with no upcoming public events the wizard says they will appear', async ({ page, api }) => {
    const { event, grace } = arrange(api);
    const hub = new EventHubPage(page);
    const upcoming = new HubSectionDialog(page, 'Upcoming events');
    await api.signInAs(grace, `/events/${event.id}/hub`);

    await hub.action('Edit', 'Upcoming events').click();
    await expect(
      upcoming.text('No upcoming public events yet. They’ll appear here automatically.'),
    ).toBeVisible();
  });
});
