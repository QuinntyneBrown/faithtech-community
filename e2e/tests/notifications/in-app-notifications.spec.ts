import { expect, test } from '../../fixtures/app';
import { photoUrl } from '../../fixtures/mock-api';
import { AppShell } from '../../pages/app-shell.page';
import { NotificationsPage } from '../../pages/notifications.page';

// L2-027 (docs/detailed-designs/notifications/in-app-notifications).
test.describe('In-app notifications', () => {
  test('the bell shows the unread count and the panel lists notices newest first', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    api.notifications.add({ recipientId: grace.profileId, title: 'Older notice' }, 30);
    api.notifications.add(
      {
        recipientId: grace.profileId,
        title: 'Tomás Ortega just joined FaithTech',
        actorName: 'Tomás Ortega',
        actorId: 'profile-9',
      },
      5,
    );
    api.notifications.add({ recipientId: 'someone-else', title: 'Not for Grace' });
    const shell = new AppShell(page);

    await api.signInAs(grace, '/team');

    await expect(shell.bell).toHaveAccessibleName('Notifications, 2 unread');
    await shell.bell.click();
    await expect(shell.notificationPanel).toBeVisible();
    await expect(shell.notificationPanel.getByRole('link')).toHaveText([
      'Tomás Ortega just joined FaithTech',
      'Older notice',
      'See all',
    ]);
    await axe.check();
  });

  test('each notice shows the member who acted, with their photo, in the panel and on the page', async ({
    page,
    api,
  }) => {
    // Given a notice raised by a member with a featured photo, one by a member without, and one with no actor
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const tomas = api.addProfile({
      id: 'profile-tomas',
      name: 'Tomás Ortega',
      photos: [
        {
          id: 'tomas-1',
          url: photoUrl('#f0a', 'tomas'),
          altText: 'Tomás smiling',
          isFeatured: true,
          uploadedAt: '2026-10-01T10:00:00Z',
        },
      ],
    });
    const ruth = api.addProfile({ id: 'profile-ruth', name: 'Ruth Alvarez' });
    api.notifications.add({ recipientId: grace.profileId, title: 'Your roles changed' }, 30);
    api.notifications.add(
      {
        recipientId: grace.profileId,
        title: 'Ruth Alvarez accepted your invite',
        actorId: ruth.id,
        actorName: ruth.name,
      },
      10,
    );
    api.notifications.add(
      {
        recipientId: grace.profileId,
        title: 'Tomás Ortega just joined FaithTech',
        actorId: tomas.id,
        actorName: tomas.name,
      },
      5,
    );
    const shell = new AppShell(page);
    const notifications = new NotificationsPage(page);

    // When Grace opens the bell panel
    await api.signInAs(grace, '/team');
    await shell.bell.click();

    // Then the notice shows the actor's photo, else their initials
    await expect(shell.panelNoticePhoto('Tomás Ortega just joined FaithTech')).toHaveAttribute(
      'src',
      photoUrl('#f0a', 'tomas'),
    );
    await expect(shell.panelNoticePhoto('Ruth Alvarez accepted your invite')).toHaveCount(0);
    await expect(shell.panelNoticePhoto('Your roles changed')).toHaveCount(0);

    // And the Notifications page shows the same
    await shell.panelSeeAll.click();
    await expect(notifications.noticePhoto('Tomás Ortega just joined FaithTech')).toHaveAttribute(
      'src',
      photoUrl('#f0a', 'tomas'),
    );
    await expect(notifications.noticePhoto('Ruth Alvarez accepted your invite')).toHaveCount(0);
  });

  test('opening a notice marks it read and goes to the related item', async ({ page, api }) => {
    const grace = api.addAccount({ email: 'grace@example.org' });
    api.notifications.add({
      recipientId: grace.profileId,
      title: 'Your roles changed',
      linkPath: '/team',
    });
    const shell = new AppShell(page);
    await api.signInAs(grace, '/');

    await shell.bell.click();
    await shell.panelNotice('Your roles changed').click();

    await expect(page).toHaveURL(/\/team$/);
    expect(api.callsTo('POST', '/api/notifications/notification-1/read')).toHaveLength(1);
    await expect(shell.bell).toHaveAccessibleName('Notifications');
  });

  test('Mark all read in the panel clears the count', async ({ page, api }) => {
    const grace = api.addAccount({ email: 'grace@example.org' });
    api.notifications.add({ recipientId: grace.profileId, title: 'One' });
    api.notifications.add({ recipientId: grace.profileId, title: 'Two' });
    const shell = new AppShell(page);
    await api.signInAs(grace, '/');

    await shell.bell.click();
    await shell.panelMarkAllRead.click();

    await expect(shell.bell).toHaveAccessibleName('Notifications');
  });

  test('the notifications page filters to unread, pages older ones and marks all read', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org' });
    for (let i = 0; i < 52; i++) {
      api.notifications.add(
        { recipientId: grace.profileId, title: `Notice ${i}`, readAt: i < 2 ? null : '2026-10-01' },
        i,
      );
    }
    const notifications = new NotificationsPage(page);
    await api.signInAs(grace, '/notifications');

    await expect(notifications.heading).toBeVisible();
    await expect(notifications.subtitle).toHaveText('2 unread');
    await expect(notifications.notices).toHaveCount(50);
    await axe.check();

    await notifications.showOlder.click();
    await expect(notifications.notices).toHaveCount(52);
    await expect(notifications.showOlder).toHaveCount(0);

    await notifications.unread.click();
    await expect(notifications.unread).toHaveAttribute('aria-pressed', 'true');
    expect(await notifications.titles()).toEqual(['Notice 0', 'Notice 1']);

    await notifications.all.click();
    await expect(notifications.notices).toHaveCount(50);

    await notifications.markAllRead.click();
    await expect(notifications.subtitle).toHaveCount(0);
    await expect(notifications.markAllRead).toHaveCount(0);
  });

  test('Mark all as read on the page clears the bell in the top bar', async ({ page, api }) => {
    const grace = api.addAccount({ email: 'grace@example.org' });
    api.notifications.add({ recipientId: grace.profileId, title: 'One' });
    api.notifications.add({ recipientId: grace.profileId, title: 'Two' });
    const shell = new AppShell(page);
    const notifications = new NotificationsPage(page);
    await api.signInAs(grace, '/notifications');
    await expect(shell.bell).toHaveAccessibleName('Notifications, 2 unread');

    await notifications.markAllRead.click();

    await expect(shell.bell).toHaveAccessibleName('Notifications');
  });

  test('a member with no notifications sees the empty state', async ({ page, api, axe }) => {
    const notifications = new NotificationsPage(page);
    await api.signInAs(api.addAccount({ email: 'grace@example.org' }), '/notifications');

    await expect(notifications.emptyState).toContainText('You’re all caught up');
    await axe.check();
  });
});
