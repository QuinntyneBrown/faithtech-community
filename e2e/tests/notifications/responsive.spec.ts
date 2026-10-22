// Traces to: L2-026, L2-027, L2-029, L2-030 with L2-045 AC1 (docs/detailed-designs/platform/responsive-layout-and-theming)
import { expect, test } from '../../fixtures/app';
import { AnnouncementsPage } from '../../pages/announcements.page';
import { ComposeAnnouncementPage } from '../../pages/compose-announcement.page';
import { NotificationsPage } from '../../pages/notifications.page';
import { SearchPage } from '../../pages/search.page';
import {
  BREAKPOINTS,
  BreakpointName,
  hasHorizontalScroll,
  undersizedTargets,
} from '../../pages/viewport';

for (const name of Object.keys(BREAKPOINTS) as BreakpointName[]) {
  test(`notifications, announcements and search fit and keep 24px targets at ${name}`, async ({
    page,
    api,
    axe,
  }) => {
    await page.setViewportSize(BREAKPOINTS[name]);
    const hannah = api.addAccount({
      email: 'hannah@example.org',
      name: 'Hannah Kim',
      roles: ['CommunicationsLead'],
    });
    api.notifications.add({
      recipientId: hannah.profileId,
      title: 'Tomás Ortega just joined FaithTech, and he is one of your contacts',
      actorName: 'Tomás Ortega',
    });
    api.announcements.add({
      subject: 'Builders Night moves to Kestrel Labs',
      body: 'Same time, new venue.',
      audience: { kind: 'Everyone' },
      senderId: hannah.profileId,
      alsoEmail: true,
      recipientIds: [hannah.profileId],
    });
    api.events.add({ title: 'Toronto Builders Night' }, 5);

    await api.signInAs(hannah, '/notifications');
    const notifications = new NotificationsPage(page);
    await expect(notifications.notices).toHaveCount(1);
    expect(await hasHorizontalScroll(page), 'notifications').toBe(false);
    expect(await undersizedTargets(page), 'notifications').toEqual([]);

    const announcements = new AnnouncementsPage(page);
    await announcements.goto();
    await expect(announcements.items).toHaveCount(1);
    expect(await hasHorizontalScroll(page), 'announcements').toBe(false);
    expect(await undersizedTargets(page), 'announcements').toEqual([]);

    const compose = new ComposeAnnouncementPage(page);
    await compose.goto();
    await expect(compose.heading).toBeVisible();
    expect(await hasHorizontalScroll(page), 'compose').toBe(false);
    expect(await undersizedTargets(page), 'compose').toEqual([]);
    await axe.check();

    const search = new SearchPage(page);
    await search.goto('builders');
    await expect(search.result('Toronto Builders Night')).toBeVisible();
    expect(await hasHorizontalScroll(page), 'search').toBe(false);
    expect(await undersizedTargets(page), 'search').toEqual([]);
    await axe.check();
  });
}
