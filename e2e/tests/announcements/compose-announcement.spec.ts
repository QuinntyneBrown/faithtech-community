import { expect, test } from '../../fixtures/app';
import { AppShell } from '../../pages/app-shell.page';
import { ComposeAnnouncementPage } from '../../pages/compose-announcement.page';
import { ErrorPages } from '../../pages/error-pages.page';

// L2-029 (docs/detailed-designs/announcements/send-announcement).
test.describe('Compose and send an announcement', () => {
  test('a Communications Lead sees the recipient count, sends to a role and every recipient is notified', async ({
    page,
    api,
    axe,
  }) => {
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
    api.addAccount({ email: 'ruth@example.org', name: 'Ruth Alvarez', roles: ['Volunteer'] });
    api.announcements.optedOut.add(samuel.profileId);
    const compose = new ComposeAnnouncementPage(page);
    await api.signInAs(hannah, '/announcements/new');

    await expect(compose.heading).toBeVisible();
    await expect(compose.send).toHaveText(/Send to 3 people/);
    await axe.check();

    await compose.chooseAudience('People with a role');
    await compose.chooseRole('Product Engineer');
    await expect(compose.send).toHaveText(/Send to 1 person/);
    await compose.write('November hackathon: teams are forming', 'Team formation opens Monday.');
    await expect(compose.alsoEmail).toBeChecked();
    await compose.send.click();

    await expect(compose.sent).toContainText('Sent to 1 person');
    await expect(compose.sent).toContainText('0 will also get it by email — 1 has opted out');
    await axe.check();
    expect(api.notifications.notifications.map((n) => n.recipientId)).toEqual([samuel.profileId]);
  });

  test('an empty subject and message show inline errors and nothing is sent', async ({
    page,
    api,
    axe,
  }) => {
    const compose = new ComposeAnnouncementPage(page);
    await api.signInAs(
      api.addAccount({ email: 'hannah@example.org', roles: ['CommunicationsLead'] }),
      '/announcements/new',
    );

    await compose.send.click();

    await expect(compose.errorSummary).toContainText('Fix 2 things to send');
    await expect(compose.subject).toHaveAttribute('aria-invalid', 'true');
    await expect(compose.message).toHaveAttribute('aria-invalid', 'true');
    expect(api.callsTo('POST', '/api/announcements')).toHaveLength(0);
    await axe.check();
  });

  test('a member who may not send is shown the forbidden page', async ({ page, api }) => {
    await api.signInAs(api.addAccount({ email: 'marcus@example.org', roles: ['CityLead'] }), '/');

    await page.goto('/announcements/new');

    await expect(new ErrorPages(page).forbidden).toBeVisible();
    expect(api.callsTo('POST', '/api/announcements')).toHaveLength(0);
  });

  test('the bell of a recipient shows the new announcement', async ({ page, api }) => {
    const hannah = api.addAccount({ email: 'hannah@example.org', roles: ['CommunicationsLead'] });
    const compose = new ComposeAnnouncementPage(page);
    await api.signInAs(hannah, '/announcements/new');
    await compose.write('Welcome', 'Welcome to the new site.');

    await compose.send.click();
    await expect(compose.sent).toBeVisible();
    await page.goto('/');

    await expect(new AppShell(page).bell).toHaveAccessibleName('Notifications, 1 unread');
  });
});
