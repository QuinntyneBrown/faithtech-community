import { expect, test } from '../../../e2e/fixtures/app';
import { AnnouncementsPage } from '../../../e2e/pages/announcements.page';
import { AppShell } from '../../../e2e/pages/app-shell.page';
import { SettingsPage } from '../../../e2e/pages/settings.page';
import { UnsubscribePage } from '../../../e2e/pages/unsubscribe.page';
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
  const ruth = api.addAccount({ email: 'ruth@example.org', name: 'Ruth Alvarez' });
  const sent = (subject: string, sentAt: string) =>
    api.announcements.add({
      subject,
      body: `About ${subject}.`,
      audience: { kind: 'Everyone' },
      senderId: hannah.profileId,
      alsoEmail: true,
      recipientIds: [ruth.profileId],
      sentAt,
    });
  sent('Welcome to the new FaithTech community site', '2026-10-06T15:00:00Z');
  sent('Builders Night moves to Kestrel Labs', '2026-10-17T15:00:00Z');
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
      await expect(announcements.items).toHaveCount(2);
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
    await expect(settings.saved).toContainText('Saved');
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
