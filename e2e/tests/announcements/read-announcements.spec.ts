import { expect, test } from '../../fixtures/app';
import { AnnouncementsPage } from '../../pages/announcements.page';
import { SettingsPage } from '../../pages/settings.page';
import { UnsubscribePage } from '../../pages/unsubscribe.page';

// L2-030 (docs/detailed-designs/announcements/read-announcements-and-opt-out).
test.describe('Read announcements and opt out', () => {
  test('a member reads the announcements sent to them, newest first', async ({
    page,
    api,
    axe,
  }) => {
    const hannah = api.addAccount({
      email: 'hannah@example.org',
      name: 'Hannah Kim',
      roles: ['CommunicationsLead'],
    });
    const ruth = api.addAccount({ email: 'ruth@example.org', name: 'Ruth Alvarez' });
    const audience = { kind: 'Everyone' };
    const sent = (subject: string, sentAt: string, recipientIds = [ruth.profileId]) =>
      api.announcements.add({
        subject,
        body: `About ${subject}.`,
        audience,
        senderId: hannah.profileId,
        alsoEmail: true,
        recipientIds,
        sentAt,
      });
    sent('Welcome to the new FaithTech community site', '2026-10-06T15:00:00Z');
    sent('Builders Night moves to Kestrel Labs', '2026-10-17T15:00:00Z');
    sent('Not for Ruth', '2026-10-18T15:00:00Z', []);
    const announcements = new AnnouncementsPage(page);

    await api.signInAs(ruth, '/announcements');

    await expect(announcements.heading).toBeVisible();
    await expect(announcements.items).toHaveCount(2);
    expect(await announcements.subjects()).toEqual([
      'Builders Night moves to Kestrel Labs',
      'Welcome to the new FaithTech community site',
    ]);
    await expect(announcements.item('Builders Night')).toContainText(
      'About Builders Night moves to Kestrel Labs.',
    );
    await expect(announcements.item('Builders Night')).toContainText('by Hannah Kim');
    await expect(announcements.newAnnouncement).toHaveCount(0);
    await axe.check();
  });

  test('a member with none sees the empty state', async ({ page, api, axe }) => {
    const announcements = new AnnouncementsPage(page);
    await api.signInAs(api.addAccount({ email: 'ruth@example.org' }), '/announcements');

    await expect(announcements.emptyState).toContainText('No announcements yet');
    await axe.check();
  });

  test('turning announcement emails off in Settings is saved', async ({ page, api, axe }) => {
    const ruth = api.addAccount({ email: 'ruth@example.org' });
    const settings = new SettingsPage(page);
    await api.signInAs(ruth, '/settings');

    await expect(settings.emailAnnouncements).toBeChecked();
    await settings.emailAnnouncements.click();

    await expect(settings.saved).toContainText('Saved');
    expect(api.announcements.optedOut.has(ruth.profileId)).toBe(true);
    await axe.check();

    await page.reload();
    await expect(settings.emailAnnouncements).not.toBeChecked();
  });

  test('the unsubscribe link from an email opts the member out without signing in', async ({
    page,
    api,
    axe,
  }) => {
    const ruth = api.addAccount({ email: 'ruth@example.org' });
    api.announcements.tokens.set('signed-token', ruth.profileId);
    const unsubscribe = new UnsubscribePage(page);

    await unsubscribe.open('signed-token');

    await expect(unsubscribe.done).toBeVisible();
    expect(api.announcements.optedOut.has(ruth.profileId)).toBe(true);
    await expect(unsubscribe.openSettings).toHaveAttribute('href', '/settings');
    await axe.check();
  });

  test('a broken unsubscribe link says so and points to Settings', async ({ page, api, axe }) => {
    const unsubscribe = new UnsubscribePage(page);

    await unsubscribe.open('made-up');

    await expect(unsubscribe.invalid).toBeVisible();
    expect(api.announcements.optedOut.size).toBe(0);
    await axe.check();
  });
});
