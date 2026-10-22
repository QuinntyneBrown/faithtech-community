// Traces to: L2-030 (docs/detailed-designs/announcements/read-announcements-and-opt-out)
import { expect, test } from '../../fixtures/app';
import { AnnouncementsPage, UnsubscribePage } from '../../pages/announcements.page';
import { SettingsPage } from '../../pages/settings.page';

test.describe('Read announcements and opt out', () => {
  // AC1: a member sees the announcements sent to them, newest first.
  test('a member reads the announcements sent to them, newest first', async ({
    page,
    api,
    axe,
  }) => {
    const hannah = api.addAccount({ email: 'hannah@example.org', name: 'Hannah Kim' });
    const ruth = api.addAccount({ email: 'ruth@example.org', name: 'Ruth Alvarez' });
    api.inbox.addAnnouncement(
      {
        subject: 'Builders Night moves to Kestrel Labs',
        senderId: hannah.profileId,
        recipientIds: [ruth.profileId],
      },
      60 * 24 * 3,
    );
    api.inbox.addAnnouncement(
      {
        subject: 'November hackathon: teams are forming',
        senderId: hannah.profileId,
        recipientIds: [ruth.profileId],
      },
      30,
    );
    api.inbox.addAnnouncement(
      {
        subject: 'Leads only: budget review',
        senderId: hannah.profileId,
        recipientIds: [hannah.profileId],
      },
      10,
    );
    const announcements = new AnnouncementsPage(page);
    await api.signInAs(ruth, '/announcements');

    await expect(announcements.heading).toBeVisible();
    await expect
      .poll(() => announcements.subjects())
      .toEqual(['November hackathon: teams are forming', 'Builders Night moves to Kestrel Labs']);
    await expect(announcements.item('November hackathon')).toContainText('Hannah Kim');
    await expect(announcements.newAnnouncement).toHaveCount(0);
    await axe.check();
    await page.emulateMedia({ colorScheme: 'dark' });
    await axe.check();
  });

  test('a member with none sees the empty state', async ({ page, api, axe }) => {
    const ruth = api.addAccount({ email: 'ruth@example.org', name: 'Ruth Alvarez' });
    const announcements = new AnnouncementsPage(page);
    await api.signInAs(ruth, '/announcements');

    await expect(announcements.empty).toBeVisible();
    await axe.check();
  });

  // AC2: turning off announcement emails is saved and applies to the next send.
  test('turning off announcement emails in settings is saved', async ({ page, api, axe }) => {
    const ruth = api.addAccount({ email: 'ruth@example.org', name: 'Ruth Alvarez' });
    const settings = new SettingsPage(page);
    await api.signInAs(ruth, '/settings');

    await expect(settings.announcementEmails).toBeChecked();
    await settings.announcementEmails.click();

    await expect(page.getByText('You’ll see announcements in the app only.')).toBeVisible();
    expect(api.inbox.optedOut.has(ruth.profileId)).toBe(true);
    await axe.check();
    await page.reload();
    await expect(settings.announcementEmails).not.toBeChecked();
  });

  // AC3: the email's unsubscribe link opts the recipient out without signing in.
  test('the unsubscribe link opts out without signing in', async ({ page, api, axe }) => {
    const ruth = api.addAccount({ email: 'ruth@example.org', name: 'Ruth Alvarez' });
    const unsubscribe = new UnsubscribePage(page);

    await unsubscribe.follow(`unsubscribe-${ruth.profileId}`);

    await expect(unsubscribe.done).toBeVisible();
    expect(api.inbox.optedOut.has(ruth.profileId)).toBe(true);
    await axe.check();
  });

  test('a broken unsubscribe link says so and points to settings', async ({ page, api, axe }) => {
    const unsubscribe = new UnsubscribePage(page);

    await unsubscribe.follow('tampered');

    await expect(unsubscribe.invalid).toBeVisible();
    expect(api.inbox.optedOut.size).toBe(0);
    await axe.check();
  });
});
