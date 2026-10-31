import { expect, test } from '../../fixtures/app';
import { FAITHTECH, NORTHSIDE } from '../../fixtures/mock-host';
import { NotAMemberPage } from '../../pages/not-a-member.page';
import { VerifyEmailPage } from '../../pages/verify-email.page';

// Traces to: L2-132 AC1 (docs/detailed-designs/organisations/accounts-and-memberships). An account that signs up on
// another organisation's host gets a verification link there; confirming it makes the account a member there.

test.describe('Joining another organisation', () => {
  test('an existing account confirms its sign-up and becomes a member of the host’s organisation', async ({
    page,
    api,
    axe,
  }) => {
    api.host.serve(NORTHSIDE);
    const account = api.addAccount({ email: 'grace@example.org', organisations: [FAITHTECH] });
    const verify = new VerifyEmailPage(page);

    await verify.openJoinLink(`user-${account.profileId}`, 'token-1', 'Grace O.', 'join-1');

    await expect(verify.verified).toBeVisible();
    expect(api.callsTo('POST', '/api/account/verify-email')[0].body).toEqual({
      userId: `user-${account.profileId}`,
      token: 'token-1',
      name: 'Grace O.',
      join: 'join-1',
    });
    await axe.check();

    await api.signInAs(account, '/events');
    await expect(new NotAMemberPage(page).heading('Northside Makers')).toHaveCount(0);
  });
});
