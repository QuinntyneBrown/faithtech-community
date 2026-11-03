import { expect, test } from '../../../e2e/fixtures/app';
import { AnnouncementsPage } from '../../../e2e/pages/announcements.page';
import { AppShell } from '../../../e2e/pages/app-shell.page';
import { SettingsPage } from '../../../e2e/pages/settings.page';
import { UnsubscribePage } from '../../../e2e/pages/unsubscribe.page';
import { featuredPhoto } from '../photos';
import { Presenter } from '../presenter';

// Journey: read announcements and opt out (docs/detailed-designs/announcements/read-announcements-and-opt-out, L2-030).
test('read-announcements-and-opt-out', async ({ page, api }) => {
  const show = await Presenter.start(page, 'read-announcements-and-opt-out');
  const announcements = new AnnouncementsPage(page);
  const shell = new AppShell(page);
  const settings = new SettingsPage(page);
  const unsubscribe = new UnsubscribePage(page);

  const hannah = api.addAccount({
    email: 'hannah@example.org',
    name: 'Hannah Kim',
    roles: ['CommunicationsLead'],
  });
  const priya = api.addAccount({
    email: 'priya@example.org',
    name: 'Priya Shah',
    roles: ['Staff'],
  });
  const ruth = api.addAccount({ email: 'ruth@example.org', name: 'Ruth Alvarez' });
  api.profiles.get(ruth.profileId)!.photos.push(featuredPhoto('ruth-alvarez'));
  const builders = api.events.add({
    title: 'Toronto Builders Night',
    startsAt: '2026-11-06T23:30:00Z',
    endsAt: '2026-11-07T02:00:00Z',
    visibility: 'Public',
  });
  // The mock's copy and recipient counts (docs/mocks/pages/announcements/default.html): Ruth and the rest.
  const sent = (
    subject: string,
    body: string,
    audience: Parameters<typeof api.announcements.add>[0]['audience'],
    sender: { profileId: string },
    recipients: number,
    sentAt: string,
  ) =>
    api.announcements.add({
      subject,
      body,
      audience,
      senderId: sender.profileId,
      alsoEmail: true,
      recipientIds: [
        ruth.profileId,
        ...Array.from({ length: recipients - 1 }, (_, i) => `member-${i + 1}`),
      ],
      sentAt,
    });
  sent(
    'Welcome to the new FaithTech community site',
    'Everyone now has a profile, events and announcements in one place. Add a photo so your city team can find you.',
    { kind: 'Everyone' },
    priya,
    612,
    '2026-10-06T15:00:00Z',
  );
  sent(
    'Builders Night moves to Kestrel Labs',
    'Same time, new venue: Kestrel Labs, 220 King St W. Doors open at 6:30 pm.',
    { kind: 'EventRsvps', eventId: builders.id },
    hannah,
    34,
    '2026-10-17T15:00:00Z',
  );
  sent(
    'November hackathon: teams are forming',
    'Team formation opens Monday. Bring an idea or join one — shelters have shared six real problems for us to work on.',
    { kind: 'Roles', roles: ['ProductEngineer'] },
    hannah,
    41,
    '2026-10-20T15:00:00Z',
  );
  api.announcements.tokens.set('signed-token', ruth.profileId);

  await show.card(
    'opening',
    'opening',
    [
      'Read announcements, choose your email',
      'Recorded against a local fake API · synthetic people',
    ],
    () => api.signInAs(ruth, '/announcements'),
  );

  await show.step(
    'list',
    async () => {
      await expect(announcements.heading).toBeVisible();
      await expect(announcements.items).toHaveCount(3);
      await expect(announcements.item('Builders Night')).toContainText('by Hannah Kim');
    },
    { poster: true },
  );

  await show.step('settings', async () => {
    await shell.accountMenu('Ruth Alvarez').click();
    await shell.menuItem('Settings').click();
    await expect(settings.emailAnnouncements).toBeChecked();
  });

  await show.step('opt-out', async () => {
    await settings.emailAnnouncements.click();
    await expect(settings.saved).toContainText('Settings saved');
    expect(api.announcements.optedOut.has(ruth.profileId)).toBe(true);
  });

  await show.step('unsubscribe', async () => {
    await unsubscribe.open('signed-token');
    await expect(unsubscribe.done).toBeVisible();
  });

  await show.step('broken', async () => {
    await unsubscribe.open('made-up');
    await expect(unsubscribe.invalid).toBeVisible();
  });

  await show.card('closing', 'closing', [
    'Everything sent to you, in one list',
    'One switch for announcement emails',
    'Unsubscribe from any email',
  ]);
  await show.finish();
});
