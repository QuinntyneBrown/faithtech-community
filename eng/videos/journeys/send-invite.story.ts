import { expect, test } from '../../../e2e/fixtures/app';
import { InvitesPage } from '../../../e2e/pages/invites.page';
import { SendInviteDialog } from '../../../e2e/pages/send-invite.dialog';
import { Presenter, typeInto } from '../presenter';

// Journey: send an invite (docs/detailed-designs/invites/send-invite, L2-010).
test('send-invite', async ({ page, api }) => {
  const show = await Presenter.start(page, 'send-invite');
  const invites = new InvitesPage(page);
  const grace = api.addAccount({
    email: 'grace@example.org',
    name: 'Grace Okonkwo',
    roles: ['CityLead'],
  });
  const marcus = api.addAccount({
    email: 'marcus@example.org',
    name: 'Marcus Lee',
    roles: ['EventLead'],
  });
  api.addInvite(
    {
      email: 'ruth.alvarez@example.org',
      invitedBy: marcus.profileId,
      preassignedRole: 'Volunteer',
      acceptedAt: '2026-10-18T12:00:00Z',
    },
    3,
  );
  api.addInvite(
    { email: 'felix.wu@example.org', invitedBy: marcus.profileId, preassignedRole: 'Attendee' },
    20,
  );

  await show.card(
    'opening',
    'opening',
    ['Invite someone to FaithTech', 'Recorded against a local fake API · synthetic people'],
    () => api.signInAs(grace, '/invites'),
  );

  await show.step('invites-list', async () => {
    await expect(invites.heading).toHaveText('Invites');
    await expect(invites.item('ruth.alvarez@example.org')).toContainText('Accepted');
    await expect(invites.item('felix.wu@example.org')).toContainText('Expired');
  });

  await show.step('resend', async () => {
    await invites.resend('felix.wu@example.org').click();
    await expect(invites.toast).toContainText('Invite sent again');
    await expect(invites.items.first()).toContainText('Pending');
  });

  const dialog = new SendInviteDialog(page);
  await show.step('open-dialog', async () => {
    await invites.inviteSomeone.click();
    await expect(dialog.email).toBeFocused();
  });

  await show.step('bad-email', async () => {
    await typeInto(dialog.email, 'nate@');
    await dialog.send.click();
    await expect(dialog.emailError).toBeVisible();
  });

  await show.step(
    'fill',
    async () => {
      await typeInto(dialog.email, 'nate.oyelaran@example.org');
      await dialog.role.selectOption({ label: 'Product Engineer' });
      await typeInto(dialog.note, 'Loved your demo at Builders Night!');
    },
    { poster: true },
  );

  await show.step('sent', async () => {
    await dialog.send.click();
    await expect(dialog.dialog).toBeHidden();
    await expect(invites.item('nate.oyelaran@example.org')).toContainText('Product Engineer');
    await expect(invites.toast).toContainText('Invite sent to nate.oyelaran@example.org');
  });

  await show.card('closing', 'closing', [
    'Every invite and its status in one list',
    'A role they may grant, plus a personal note',
    'Expired invites can be sent again',
  ]);
  await show.finish();
});
