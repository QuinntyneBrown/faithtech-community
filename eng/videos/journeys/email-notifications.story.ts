import { expect, test } from '../../../e2e/fixtures/app';
import { AppShell } from '../../../e2e/pages/app-shell.page';
import { EventPage } from '../../../e2e/pages/event.page';
import { SettingsPage } from '../../../e2e/pages/settings.page';
import { showEmail } from '../mail-preview';
import { featuredPhoto } from '../photos';
import { Presenter } from '../presenter';

test.use({ timezoneId: 'America/Toronto' });

// Journey: email notifications (docs/detailed-designs/notifications/email-notifications, L2-028).
test('email-notifications', async ({ page, api }) => {
  const show = await Presenter.start(page, 'email-notifications');
  const shell = new AppShell(page);
  const eventPage = new EventPage(page);
  const settings = new SettingsPage(page);

  const marcus = api.addProfile({
    name: 'Marcus Lee',
    roles: ['EventLead'],
    photos: [featuredPhoto('marcus-lee')],
  });
  const event = api.events.add({
    title: 'Toronto Builders Night',
    description:
      'An evening for Christians who build: developers, designers, product people and the curious. Short demos from three local teams, then open tables to find collaborators for the November hackathon.',
    createdById: marcus.id,
    startsAt: '2026-11-06T23:30:00.000Z',
    endsAt: '2026-11-07T02:00:00.000Z',
    visibility: 'Public',
  });
  const leah = api.addAccount({
    email: 'leah@example.org',
    name: 'Leah Thompson',
    roles: ['Attendee'],
  });
  api.profiles.get(leah.profileId)!.photos.push(featuredPhoto('leah-thompson'));

  await show.card(
    'opening',
    'opening',
    ['Stay informed by email', 'Recorded against a local fake API · synthetic people and events'],
    () => api.signInAs(leah, `/events/${event.id}`),
  );

  await show.step('rsvp', async () => {
    await eventPage.rsvp.click();
    await expect(eventPage.going).toBeVisible();
  });

  // The confirmation the RSVP queued, as it reaches Leah's inbox (docs/mocks/notifications/email/success.html).
  await show.step('rsvp-email', async () => {
    const confirmation = api.events.emails.find((e) => e.to === 'leah@example.org');
    expect(confirmation).toEqual(
      expect.objectContaining({
        attachment: { fileName: 'toronto-builders-night.ics', contentType: 'text/calendar' },
      }),
    );
    await showEmail(page, {
      from: 'FaithTech Community <hello@faithtech.community>',
      to: confirmation!.to,
      subject: confirmation!.subject,
      body: confirmation!.body,
    });
  });

  await show.step(
    'settings',
    async () => {
      await page.goto(`/events/${event.id}`);
      await shell.accountMenu('Leah Thompson').click();
      await shell.menuItem('Settings').click();
      await expect(settings.heading).toBeVisible();
      await expect(settings.emailCard).toBeVisible();
      await expect(settings.emailAnnouncements).toBeChecked();
    },
    { poster: true },
  );

  await show.step('opt-out', async () => {
    await settings.emailAnnouncements.click();
    await expect(settings.saved).toContainText('Settings saved');
    // Off the switch, so the frame shows its resting off colour rather than its hover.
    await page.mouse.move(1000, 650);
  });

  // Other emails still come: the event changes, and Leah hears about it in the app and by email (L2-028 AC3).
  await show.step('others', async () => {
    await expect(settings.emailAnnouncements).not.toBeChecked();
    api.notifications.add({
      recipientId: leah.profileId,
      kind: 'EventChanged',
      title: 'Toronto Builders Night changed. Check the new details.',
      linkText: 'Toronto Builders Night',
      linkPath: `/events/${event.id}`,
      actorId: marcus.id,
      actorName: marcus.name,
    });
    await page.reload();
    await shell.bell.click();
    await expect(
      shell.panelNotice('Toronto Builders Night changed. Check the new details.'),
    ).toBeVisible();
  });

  await show.card('closing', 'closing', [
    'Confirmations, changes and invites by email',
    'Plain-text copy and secure links',
    'Announcements are the one you can switch off',
  ]);
  await show.finish();
});
