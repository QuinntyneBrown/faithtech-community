// Traces to: L2-029 (docs/detailed-designs/announcements/send-announcement)
import { expect, test } from '../../fixtures/app';
import { MockApi } from '../../fixtures/mock-api';
import { ComposeAnnouncementPage } from '../../pages/announcements.page';
import { NotificationBell } from '../../pages/notifications.page';

function addMembers(api: MockApi) {
  const hannah = api.addAccount({
    email: 'hannah@example.org',
    name: 'Hannah Kim',
    roles: ['CommunicationsLead'],
  });
  const ruth = api.addAccount({
    email: 'ruth@example.org',
    name: 'Ruth Alvarez',
    roles: ['Volunteer'],
  });
  const nate = api.addAccount({
    email: 'nate@example.org',
    name: 'Nate Oyelaran',
    roles: ['ProductEngineer'],
  });
  api.addAccount({ email: 'felix@example.org', name: 'Felix Wu', suspended: true });
  return { hannah, ruth, nate };
}

test.describe('Send an announcement', () => {
  // AC4: the number of recipients is shown before sending; AC1: each recipient is notified.
  test('a Communications Lead sends to people with a role, seeing the count first', async ({
    page,
    api,
    axe,
  }) => {
    const { hannah, ruth, nate } = addMembers(api);
    const compose = new ComposeAnnouncementPage(page);
    await api.signInAs(hannah, '/announcements/new');

    await expect(compose.heading).toBeVisible();
    // Everyone but the suspended member.
    await expect(compose.sendButton()).toHaveText(/Send to 3 people/);
    await axe.check();

    await compose.audience('People with a role').check();
    await compose.role('Volunteer').check();
    await expect(compose.sendButton()).toHaveText(/Send to 1 person/);
    await compose.role('Product Engineer').check();
    await expect(compose.sendButton()).toHaveText(/Send to 2 people/);
    await compose.subject.fill('November hackathon: teams are forming');
    await compose.message.fill('Team formation opens Monday.');
    await compose.send();

    await expect(compose.sentHeading()).toHaveText('Sent to 2 people');
    await expect(page.getByText('2 will also get it by email.')).toBeVisible();
    await axe.check();
    expect(api.inbox.notifications.map((n) => n.recipientId).sort()).toEqual(
      [nate.profileId, ruth.profileId].sort(),
    );

    // The recipient sees it in the bell.
    await api.signInAs(ruth);
    const bell = new NotificationBell(page);
    await expect(bell.button).toHaveAccessibleName('Notifications, 1 unread');
  });

  test('sending to an event’s RSVP list reaches the members who RSVP’d', async ({
    page,
    api,
    axe,
  }) => {
    const { hannah, ruth } = addMembers(api);
    const hackathon = api.events.add(
      { title: 'Hackathon: Tech for Shelters', type: 'Hackathon' },
      14,
    );
    api.events.addMember(hackathon, ruth.profileId);
    const compose = new ComposeAnnouncementPage(page);
    await api.signInAs(hannah, '/announcements/new');

    await compose.audience('An event’s RSVP list').check();
    await compose.chooseEvent('Hackathon: Tech for Shelters');
    await expect(compose.sendButton()).toHaveText(/Send to 1 person/);
    await axe.check();
    await compose.subject.fill('Check-in opens at 8:30');
    await compose.message.fill('Bring a laptop and a charger.');
    await compose.send();

    await expect(compose.sentHeading()).toHaveText('Sent to 1 person');
    expect(api.inbox.announcements.at(-1)?.audience).toMatchObject({
      kind: 'EventRsvps',
      eventId: hackathon.id,
    });
  });

  // AC2: an empty subject or body shows inline errors.
  test('an empty subject and message show inline errors and send nothing', async ({
    page,
    api,
    axe,
  }) => {
    const { hannah } = addMembers(api);
    const compose = new ComposeAnnouncementPage(page);
    await api.signInAs(hannah, '/announcements/new');

    await compose.send();

    await expect(compose.errorSummary).toBeVisible();
    await expect(compose.fieldError('Add a subject so people know what it’s about.')).toBeVisible();
    await expect(compose.fieldError('Write a message of at least one sentence.')).toBeVisible();
    expect(api.callsTo('POST', '/api/announcements')).toHaveLength(0);
    await axe.check();
  });

  // AC3: anyone else is refused; the page sends them to Forbidden and the API answers 403.
  test('a member who may not send is shown the forbidden page', async ({ page, api }) => {
    const { ruth } = addMembers(api);
    await api.signInAs(ruth, '/announcements');

    await page.goto('/announcements/new');

    await expect(page).toHaveURL(/\/forbidden$/);
  });
});
