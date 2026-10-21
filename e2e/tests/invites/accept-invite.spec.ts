// Traces to: L2-011 (docs/detailed-designs/invites/accept-invite)
import { expect, test } from '../../fixtures/app';
import { AcceptInvitePage } from '../../pages/accept-invite.page';
import { ProfilePage } from '../../pages/profile.page';
import { SignInPage } from '../../pages/sign-in.page';

test.describe('Accept an invite', () => {
  test('a newcomer joins with the invited email and gets the role', async ({ page, api, axe }) => {
    const grace = api.addAccount({ email: 'grace@example.org', name: 'Grace Okonkwo' });
    api.profiles.get(grace.profileId)!.homeCity = 'Toronto';
    const invite = api.addInvite({
      email: 'ruth.alvarez@example.org',
      invitedBy: grace.profileId,
      preassignedRole: 'Volunteer',
    });
    const accept = new AcceptInvitePage(page);
    await accept.open(invite.token);

    await expect(accept.heading).toHaveText('You’re invited');
    await expect(accept.invitation).toContainText(
      'Grace Okonkwo invited you to join FaithTech Toronto as a Volunteer',
    );
    await expect(accept.email).toHaveValue('ruth.alvarez@example.org');
    await axe.check();

    await accept.name.fill('Ruth Alvarez');
    await accept.password.fill('short');
    await accept.acceptAndJoin.click();
    await expect(accept.errorSummary).toContainText('Use at least 12 characters.');
    await axe.check();

    await accept.password.fill('a-long-enough-passphrase');
    await accept.acceptAndJoin.click();

    const profile = new ProfilePage(page);
    await expect(page).toHaveURL(/\/people\/me$/);
    await expect(profile.heading).toHaveText('Ruth Alvarez');
    await expect(profile.roles).toHaveText(['Volunteer']);
  });

  test('an existing member signs in to accept and the role is added', async ({ page, api }) => {
    const grace = api.addAccount({ email: 'grace@example.org', name: 'Grace Okonkwo' });
    const jonah = api.addAccount({
      email: 'jonah@example.org',
      name: 'Jonah Bell',
      roles: ['Attendee'],
    });
    const invite = api.addInvite({
      email: 'jonah@example.org',
      invitedBy: grace.profileId,
      preassignedRole: 'Volunteer',
    });
    const accept = new AcceptInvitePage(page);
    await accept.open(invite.token);

    await accept.signInToAccept.click();
    await expect(new SignInPage(page).heading).toBeVisible();
    await api.signInAs(jonah, `/accept-invite/${invite.token}`);
    await accept.acceptInvite.click();

    await expect(page).toHaveURL(/\/people\/me$/);
    await expect(new ProfilePage(page).roles).toHaveText(['Attendee', 'Volunteer']);
  });

  test('a signed-in member with another email cannot take the invite', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', name: 'Grace Okonkwo' });
    const jonah = api.addAccount({ email: 'jonah@example.org', name: 'Jonah Bell' });
    const invite = api.addInvite({ email: 'ruth.alvarez@example.org', invitedBy: grace.profileId });
    const accept = new AcceptInvitePage(page);
    await api.signInAs(jonah, `/accept-invite/${invite.token}`);

    await expect(accept.heading).toHaveText('This invite is for another email');
    await expect(accept.acceptInvite).toHaveCount(0);
    await axe.check();
  });

  test('an expired invite shows an error with a link to sign up', async ({ page, api, axe }) => {
    const grace = api.addAccount({ email: 'grace@example.org', name: 'Grace Okonkwo' });
    const invite = api.addInvite({ email: 'felix.wu@example.org', invitedBy: grace.profileId }, 20);
    const accept = new AcceptInvitePage(page);
    await accept.open(invite.token);

    await expect(accept.heading).toHaveText('This invite has expired');
    await expect(accept.createAccount).toHaveAttribute('href', '/sign-up');
    await axe.check();
  });

  test('a used or unknown link shows an error', async ({ page, api }) => {
    const grace = api.addAccount({ email: 'grace@example.org' });
    const used = api.addInvite({
      email: 'ruth@example.org',
      invitedBy: grace.profileId,
      acceptedAt: '2026-10-20T12:00:00Z',
    });
    const accept = new AcceptInvitePage(page);

    await accept.open(used.token);
    await expect(accept.heading).toHaveText('This invite has already been used');
    await accept.open('no-such-token');
    await expect(accept.heading).toHaveText('This invite link isn’t valid');
  });
});
