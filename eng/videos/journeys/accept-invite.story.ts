import { expect, test } from '../../../e2e/fixtures/app';
import { AcceptInvitePage } from '../../../e2e/pages/accept-invite.page';
import { ProfilePage } from '../../../e2e/pages/profile.page';
import { Presenter, typeInto } from '../presenter';

// Journey: accept an invite (docs/detailed-designs/invites/accept-invite, L2-011).
test('accept-invite', async ({ page, api }) => {
  const show = await Presenter.start(page, 'accept-invite');
  const accept = new AcceptInvitePage(page);
  const profile = new ProfilePage(page);
  const grace = api.addAccount({ email: 'grace@example.org', name: 'Grace Okonkwo' });
  api.profiles.get(grace.profileId)!.homeCity = 'Toronto';
  const invite = api.addInvite({
    email: 'ruth.alvarez@example.org',
    invitedBy: grace.profileId,
    preassignedRole: 'Volunteer',
  });
  const expired = api.addInvite({ email: 'felix.wu@example.org', invitedBy: grace.profileId }, 20);

  await show.card(
    'opening',
    'opening',
    ['Join FaithTech from an invite', 'Recorded against a local fake API · synthetic people'],
    () => accept.open(invite.token),
  );

  await show.step('invitation', async () => {
    await expect(accept.heading).toHaveText('You’re invited');
    await expect(accept.invitation).toContainText(
      'Grace Okonkwo invited you to join FaithTech Toronto as a Volunteer',
    );
    await expect(accept.email).toHaveValue('ruth.alvarez@example.org');
  });

  await show.step('short-password', async () => {
    await typeInto(accept.name, 'Ruth Alvarez');
    await typeInto(accept.password, 'short');
    await accept.acceptAndJoin.click();
    await expect(accept.errorSummary).toContainText('Use at least 12 characters.');
  });

  await show.step(
    'join',
    async () => {
      await typeInto(accept.password, 'a-long-enough-passphrase');
      await accept.acceptAndJoin.click();
      await expect(page).toHaveURL(/\/people\/me$/);
      await expect(profile.heading).toHaveText('Ruth Alvarez');
      await expect(profile.roles).toHaveText(['Volunteer']);
    },
    { poster: true },
  );

  await show.step('used-link', async () => {
    await accept.open(invite.token);
    await expect(accept.heading).toHaveText('This invite has already been used');
  });

  await show.step('expired-link', async () => {
    await accept.open(expired.token);
    await expect(accept.heading).toHaveText('This invite has expired');
    await expect(accept.createAccount).toBeVisible();
  });

  await show.card('closing', 'closing', [
    'An invite link takes you straight to joining',
    'You land signed in, with the role you were invited with',
    'Used and expired links explain themselves',
  ]);
  await show.finish();
});
