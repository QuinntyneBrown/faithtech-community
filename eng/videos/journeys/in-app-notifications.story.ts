import { expect, test } from '../../../e2e/fixtures/app';
import { AppShell } from '../../../e2e/pages/app-shell.page';
import { NotificationsPage } from '../../../e2e/pages/notifications.page';
import { Presenter } from '../presenter';

// Journey: in-app notifications (docs/detailed-designs/notifications/in-app-notifications, L2-027).
test('in-app-notifications', async ({ page, api }) => {
  const show = await Presenter.start(page, 'in-app-notifications');
  const shell = new AppShell(page);
  const notifications = new NotificationsPage(page);

  const grace = api.addAccount({
    email: 'grace@example.org',
    name: 'Grace Okafor',
    roles: ['CityLead'],
  });
  api.notifications.add(
    { recipientId: grace.profileId, title: 'Older notice', readAt: '2026-10-01' },
    600,
  );
  api.notifications.add(
    { recipientId: grace.profileId, title: 'Your roles changed', linkPath: '/team' },
    30,
  );
  api.notifications.add(
    {
      recipientId: grace.profileId,
      title: 'Tomás Ortega just joined FaithTech',
      actorName: 'Tomás Ortega',
      actorId: 'profile-9',
      linkPath: '/team',
    },
    5,
  );
  api.notifications.add(
    {
      recipientId: grace.profileId,
      title: 'Builders Night has a new venue',
      linkPath: '/events',
    },
    2,
  );

  await show.card(
    'opening',
    'opening',
    [
      'Keep up with the community',
      'Recorded against a local fake API · synthetic people and events',
    ],
    () => api.signInAs(grace, '/team'),
  );

  await show.step('bell', async () => {
    await expect(shell.bell).toHaveAccessibleName('Notifications, 3 unread');
  });

  await show.step(
    'panel',
    async () => {
      await shell.bell.click();
      await expect(shell.notificationPanel).toBeVisible();
      await expect(shell.panelNotice('Your roles changed')).toBeVisible();
    },
    { poster: true },
  );

  await show.step('open-notice', async () => {
    await shell.panelNotice('Your roles changed').click();
    await expect(page).toHaveURL(/\/team$/);
    await expect(shell.bell).toHaveAccessibleName('Notifications, 2 unread');
  });

  await show.step('see-all', async () => {
    await shell.bell.click();
    await shell.panelSeeAll.click();
    await expect(notifications.heading).toBeVisible();
    await expect(notifications.subtitle).toHaveText('2 unread');
  });

  await show.step('unread', async () => {
    await notifications.unread.click();
    await expect(notifications.unread).toHaveAttribute('aria-pressed', 'true');
    await expect(notifications.notices).toHaveCount(2);
  });

  await show.step('mark-all', async () => {
    await notifications.markAllRead.click();
    await expect(notifications.subtitle).toHaveCount(0);
    await expect(shell.bell).toHaveAccessibleName('Notifications');
  });

  await show.card('closing', 'closing', [
    'A bell that counts what is unread',
    'A quick panel and a full page',
    'Open, filter or mark all as read',
  ]);
  await show.finish();
});
