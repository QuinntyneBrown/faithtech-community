// Traces to: L2-027 (docs/detailed-designs/notifications/in-app-notifications)
import { expect, test } from '../../fixtures/app';
import { MockApi } from '../../fixtures/mock-api';
import { NotificationBell, NotificationsPage } from '../../pages/notifications.page';

function addInbox(api: MockApi) {
  const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
  const event = api.events.add({ title: 'Toronto Builders Night' });
  api.addNotification(
    {
      recipientId: grace.profileId,
      kind: 'EventChanged',
      title: 'Toronto Builders Night changed. Check the new details.',
      linkPath: `/events/${event.id}`,
    },
    90,
  );
  api.addNotification(
    {
      recipientId: grace.profileId,
      kind: 'Announcement',
      title: 'Hannah Kim sent “November hackathon: teams are forming”',
      linkPath: '/announcements',
      actorName: 'Hannah Kim',
    },
    5,
  );
  api.addNotification(
    {
      recipientId: grace.profileId,
      kind: 'RoleChanged',
      title: 'Priya Shah added the City Lead role to your profile',
      linkPath: '/people/me',
      actorName: 'Priya Shah',
      readAt: '2026-10-20T09:00:00Z',
    },
    60 * 26,
  );
  // Someone else's notice never shows.
  api.addNotification({ recipientId: 'profile-99', title: 'Not for Grace' });
  return { grace, event };
}

test.describe('In-app notifications', () => {
  // AC1: the bell shows an unread count, and the panel lists notifications newest first.
  test('the bell counts unread notices and the panel lists them newest first', async ({
    page,
    api,
    axe,
  }) => {
    const { grace } = addInbox(api);
    await api.freezeBrowserClock();
    const bell = new NotificationBell(page);
    await api.signInAs(grace);

    await expect(bell.button).toHaveAccessibleName('Notifications, 2 unread');
    await bell.open();

    await expect(bell.panel).toBeVisible();
    await expect
      .poll(() => bell.titles())
      .toEqual([
        'Hannah Kim sent “November hackathon: teams are forming”',
        'Toronto Builders Night changed. Check the new details.',
        'Priya Shah added the City Lead role to your profile',
      ]);
    await axe.check();
    await page.emulateMedia({ colorScheme: 'dark' });
    await axe.check();
  });

  // AC2: opening a notification marks it read and takes the member to the related item.
  test('opening a notice marks it read and goes to its item', async ({ page, api }) => {
    const { grace, event } = addInbox(api);
    const bell = new NotificationBell(page);
    await api.signInAs(grace);

    await bell.open();
    await bell.openNotice('Toronto Builders Night changed. Check the new details.');

    await expect(page).toHaveURL(new RegExp(`/events/${event.id}$`));
    await expect(bell.button).toHaveAccessibleName('Notifications, 1 unread');
  });

  // AC3: "Mark all as read" clears the count.
  test('mark all read clears the count from the panel and the page', async ({ page, api, axe }) => {
    const { grace } = addInbox(api);
    const bell = new NotificationBell(page);
    const notifications = new NotificationsPage(page);
    await api.signInAs(grace);

    await bell.open();
    await bell.markAllRead.click();
    await expect(bell.button).toHaveAccessibleName('Notifications');
    await page.keyboard.press('Escape');

    await notifications.open();
    await expect(notifications.heading).toBeVisible();
    await expect(notifications.notices).toHaveCount(3);
    await expect(notifications.unreadNotices()).toHaveCount(0);
    await expect(notifications.markAllRead).toHaveCount(0);
    await axe.check();
  });

  test('the page marks everything read and filters to unread', async ({ page, api }) => {
    const { grace } = addInbox(api);
    const notifications = new NotificationsPage(page);
    await api.signInAs(grace, '/notifications');

    await notifications.unread.click();
    await expect(notifications.notices).toHaveCount(2);
    await notifications.all.click();
    await expect(notifications.notices).toHaveCount(3);

    await notifications.markAllRead.click();
    await expect(notifications.unreadNotices()).toHaveCount(0);
    await expect(new NotificationBell(page).button).toHaveAccessibleName('Notifications');
  });

  // AC4: the notifications page shows an empty state when there are none.
  test('a member with no notifications sees the empty state', async ({ page, api, axe }) => {
    const leah = api.addAccount({ email: 'leah@example.org', name: 'Leah Thompson' });
    const notifications = new NotificationsPage(page);
    const bell = new NotificationBell(page);
    await api.signInAs(leah, '/notifications');

    await expect(notifications.empty).toBeVisible();
    await expect(bell.button).toHaveAccessibleName('Notifications');
    await axe.check();

    await bell.open();
    await expect(bell.caughtUp).toBeVisible();
    await axe.check();
  });
});
