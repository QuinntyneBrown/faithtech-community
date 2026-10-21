// Traces to: L2-010 (docs/detailed-designs/invites/send-invite)
import { expect, test } from '../../fixtures/app';
import { InvitesPage } from '../../pages/invites.page';
import { SendInviteDialog } from '../../pages/send-invite.dialog';

test.describe('Send invites', () => {
  test('a lead sees every lead’s invites with their status and resends an expired one', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const marcus = api.addAccount({
      email: 'marcus@example.org',
      name: 'Marcus Lee',
      roles: ['EventLead'],
    });
    api.addInvite(
      {
        email: 'nate.oyelaran@example.org',
        invitedBy: grace.profileId,
        preassignedRole: 'ProductEngineer',
      },
      1,
    );
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
    const invites = new InvitesPage(page);
    await api.signInAs(grace, '/invites');

    await expect(invites.heading).toHaveText('Invites');
    await expect(invites.item('nate.oyelaran@example.org')).toContainText('Pending');
    await expect(invites.item('ruth.alvarez@example.org')).toContainText('Accepted');
    await expect(invites.item('felix.wu@example.org')).toContainText('Expired');
    await expect(invites.resend('nate.oyelaran@example.org')).toHaveCount(0);
    await axe.check();

    await invites.resend('felix.wu@example.org').click();

    await expect(invites.toast).toContainText('Invite sent again');
    await expect(invites.items.first()).toContainText('felix.wu@example.org');
    await expect(invites.items.first()).toContainText('Pending');
  });

  test('a City Lead invites someone with a role they may grant and a note', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const invites = new InvitesPage(page);
    await api.signInAs(grace, '/invites');
    await expect(invites.empty).toBeVisible();
    await axe.check();

    await invites.inviteSomeone.click();
    const dialog = new SendInviteDialog(page);
    await expect(dialog.role.locator('option')).toHaveText([
      'No role',
      'Attendee',
      'Volunteer',
      'Product Engineer',
      'Event Lead',
      'Create Lead',
      'Communications Lead',
    ]);
    await axe.check();
    await dialog.email.fill('nate@');
    await dialog.send.click();
    await expect(dialog.emailError).toBeVisible();

    await dialog.email.fill('nate.oyelaran@example.org');
    await dialog.role.selectOption({ label: 'Product Engineer' });
    await dialog.note.fill('Loved your demo at Builders Night!');
    await dialog.send.click();

    await expect(dialog.dialog).toBeHidden();
    await expect(invites.item('nate.oyelaran@example.org')).toContainText('Product Engineer');
    await expect(invites.toast).toContainText('Invite sent to nate.oyelaran@example.org');
    expect(api.callsTo('POST', '/api/invites')[0].body).toEqual({
      email: 'nate.oyelaran@example.org',
      preassignedRole: 'ProductEngineer',
      note: 'Loved your demo at Builders Night!',
    });
  });

  test('the 51st invite in 24 hours is refused with a rate-limit message', async ({
    page,
    api,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    for (let i = 0; i < 50; i++) {
      api.addInvite({ email: `bulk${i}@example.org`, invitedBy: grace.profileId }, 0.5);
    }
    const invites = new InvitesPage(page);
    await api.signInAs(grace, '/invites');

    await invites.inviteSomeone.click();
    const dialog = new SendInviteDialog(page);
    await dialog.email.fill('one-more@example.org');
    await dialog.send.click();

    await expect(dialog.refusal).toContainText('You’ve sent 50 invites in the last 24 hours.');
    await expect(dialog.dialog).toBeVisible();
  });
});
