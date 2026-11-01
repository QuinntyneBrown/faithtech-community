// Traces to: L2-157 AC2, L2-161 AC1 to AC3, AC5 (docs/detailed-designs/events/fill-in-hub-sections)
import { expect, test } from '../../fixtures/app';
import { MockApi } from '../../fixtures/mock-api';
import { EventHubPage } from '../../pages/event-hub.page';
import { HubPeopleDialog } from '../../pages/hub-people.dialog';
import { HubSectionPreviewDialog } from '../../pages/hub-section-preview.dialog';

test.use({ timezoneId: 'America/Toronto' });

function arrange(api: MockApi) {
  const event = api.events.add({
    title: 'Toronto Builders Night',
    startsAt: '2026-11-06T23:30:00.000Z',
    endsAt: '2026-11-07T02:00:00.000Z',
    venue: 'Kestrel Labs, 220 King St W, Toronto',
    visibility: 'Public',
  });
  api.events.hubs.add(event);
  const grace = api.addAccount({
    email: 'grace@example.org',
    name: 'Grace Okonkwo',
    roles: ['CityLead'],
  });
  const hannah = api.addAccount({
    email: 'hannah@example.org',
    name: 'Hannah Kim',
    roles: ['CommunicationsLead'],
  });
  const samuel = api.addAccount({
    email: 'samuel@example.org',
    name: 'Samuel Mensah',
    roles: ['ProductEngineer'],
  });
  return { event, grace, hannah, samuel };
}

test.describe('Hub sections: People', () => {
  // L2-161 AC1 to AC3, AC5; L2-157 AC2.
  test('a lead adds members and a guest, gives each a role and reviews them', async ({
    page,
    api,
    axe,
  }) => {
    const { event, grace, hannah, samuel } = arrange(api);
    const hub = new EventHubPage(page);
    const people = new HubPeopleDialog(page);
    await api.signInAs(grace, `/events/${event.id}/hub`);

    await hub.action('Fill in', 'People').click();
    await expect(people.question).toHaveText('Who’s helping on the day?');
    await expect(people.empty).toBeVisible();
    await axe.check();

    await people.addMember('Hann', 'Hannah Kim');
    await people.roleOf('Hannah Kim').selectOption('Speaker');
    await people.addMember('Sam', 'Samuel Mensah');
    await expect(people.roleOf('Samuel Mensah')).toHaveValue('Mentor');

    await people.addGuest.click();
    await expect(people.guestNote).toBeVisible();
    await people.addGuestConfirm.click();
    await expect(people.text('Enter their name.')).toBeVisible();
    await people.guestName.fill('Nadia Farouk');
    await people.guestAbout.fill('Founder, Kestrel Labs');
    await people.guestRole.selectOption('Judge');
    await people.addGuestConfirm.click();
    await expect(people.person('Nadia Farouk')).toContainText('Guest · Founder, Kestrel Labs');
    await axe.check();

    await people.next.click();
    await expect(people.step).toHaveText(/Step 2 of 2\s*Review/);
    await expect(people.group('Speakers')).toContainText('Hannah Kim');
    await expect(people.group('Mentors')).toContainText('Samuel Mensah');
    await expect(people.group('Judges')).toContainText('Nadia Farouk');
    expect(api.events.hubs.section(event.id, 'People')?.content).toEqual({
      people: [
        { profileId: hannah.profileId, name: null, line: null, role: 'Speaker' },
        { profileId: samuel.profileId, name: null, line: null, role: 'Mentor' },
        { profileId: null, name: 'Nadia Farouk', line: 'Founder, Kestrel Labs', role: 'Judge' },
      ],
    });

    await people.save.click();
    await expect(hub.toast('People saved')).toBeVisible();
    await expect(hub.row('People')).toContainText('Ready');

    await hub.more('People').click();
    await hub.menuItem('Preview').click();
    const preview = new HubSectionPreviewDialog(page, 'People');
    await expect(preview.heading('People')).toBeVisible();
    await expect(preview.text('Hannah Kim')).toBeVisible();
    await expect(preview.text('Founder, Kestrel Labs')).toBeVisible();
  });

  // L2-161 AC1: Remove takes a person off the list.
  test('a lead removes a person and is back to an empty list', async ({ page, api }) => {
    const { event, grace, hannah } = arrange(api);
    api.events.hubs.fill(event.id, 'People', {
      people: [{ profileId: hannah.profileId, name: null, line: null, role: 'Mentor' }],
    });
    const hub = new EventHubPage(page);
    const people = new HubPeopleDialog(page);
    await api.signInAs(grace, `/events/${event.id}/hub`);

    await hub.action('Edit', 'People').click();
    await expect(people.roleOf('Hannah Kim')).toHaveValue('Mentor');
    await people.remove('Hannah Kim').click();
    await expect(people.empty).toBeVisible();
  });
});
