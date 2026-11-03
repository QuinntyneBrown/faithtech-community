import { expect, test } from '../../../e2e/fixtures/app';
import { AppShell } from '../../../e2e/pages/app-shell.page';
import { NotificationsPage } from '../../../e2e/pages/notifications.page';
import { featuredPhoto, Scene } from '../photos';
import { Presenter } from '../presenter';

// Journey: in-app notifications (docs/detailed-designs/notifications/in-app-notifications, L2-027).
test('in-app-notifications', async ({ page, api }) => {
  const show = await Presenter.start(page, 'in-app-notifications');
  const shell = new AppShell(page);
  const notifications = new NotificationsPage(page);

  // Wednesday 21 October 2026, 3:42 pm in Toronto, as the bell mock (docs/mocks/notifications/bell/unread.html).
  api.now = new Date('2026-10-21T19:42:00Z');
  await api.freezeBrowserClock();
  const grace = api.addAccount({
    email: 'grace@example.org',
    name: 'Grace Okonkwo',
    roles: ['CityLead'],
    profileId: 'profile-grace7',
  });
  api.profiles.get(grace.profileId)!.photos.push(featuredPhoto('grace-okonkwo'));
  const person = (id: string, name: string, scene: Scene) => {
    api.addProfile({ id, name, roles: ['Volunteer'], photos: [featuredPhoto(scene)] });
    return { id, name };
  };
  const notify = (
    actor: { id: string; name: string },
    kind: string,
    title: string,
    linkText: string | null,
    linkPath: string,
    minutesAgo: number,
  ) =>
    api.notifications.add(
      {
        recipientId: grace.profileId,
        kind,
        title,
        linkText,
        linkPath,
        actorId: actor.id,
        actorName: actor.name,
      },
      minutesAgo,
    );
  // The notices of the mocks (docs/mocks/pages/notifications/default.html), in the sentences the API writes.
  const hannah = person('profile-hannah5', 'Hannah Kim', 'hannah-kim');
  const ruth = person('profile-ruth1', 'Ruth Alvarez', 'ruth-alvarez');
  const esther = person('profile-esther1', 'Esther Nakamura', 'esther-nakamura');
  const tomas = person('profile-tomas', 'Tomás Ortega', 'tomas-ortega');
  const marcus = person('profile-marcus1', 'Marcus Lee', 'marcus-lee');
  notify(
    hannah,
    'Announcement',
    'Builders Night moves to Kestrel Labs',
    null,
    '/announcements',
    6000,
  ).readAt = '2026-10-17T20:00:00Z';
  notify(
    ruth,
    'InviteAccepted',
    'Ruth Alvarez accepted your invite',
    'Ruth Alvarez',
    `/people/${ruth.id}`,
    4320,
  );
  notify(
    esther,
    'EventCancelled',
    'Austin Faith & AI Panel was cancelled',
    'Austin Faith & AI Panel',
    '/events/event-austin',
    1290,
  );
  notify(
    tomas,
    'ContactSignedUp',
    'Tomás Ortega just joined FaithTech',
    'Tomás Ortega',
    '/contacts/contact-9',
    240,
  );
  notify(
    marcus,
    'PlanningPokerInvite',
    'Marcus invited you to Planning Poker in Toronto team',
    'Planning Poker',
    '/workspaces/workspace-1/poker',
    97,
  );

  await show.card(
    'opening',
    'opening',
    [
      'Keep up with the community',
      'Recorded against a local fake API · synthetic people and events',
    ],
    () => api.signInAs(grace, '/'),
  );

  await show.step('bell', async () => {
    await expect(shell.bell).toHaveAccessibleName('Notifications, 4 unread');
  });

  await show.step(
    'panel',
    async () => {
      await shell.bell.click();
      await expect(shell.notificationPanel).toBeVisible();
      await expect(shell.panelNotice('Ruth Alvarez accepted your invite')).toHaveText(
        'Ruth Alvarez',
      );
    },
    { poster: true },
  );

  await show.step('open-notice', async () => {
    await shell.panelNotice('Ruth Alvarez accepted your invite').click();
    await expect(page).toHaveURL(/\/people\/profile-ruth1$/);
    await expect(shell.bell).toHaveAccessibleName('Notifications, 3 unread');
  });

  await show.step('see-all', async () => {
    await shell.bell.click();
    await shell.panelSeeAll.click();
    await expect(notifications.heading).toBeVisible();
    await expect(notifications.subtitle).toHaveText('3 unread');
  });

  await show.step('unread', async () => {
    await notifications.unread.click();
    await expect(notifications.unread).toHaveAttribute('aria-pressed', 'true');
    await expect(notifications.notices).toHaveCount(3);
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
