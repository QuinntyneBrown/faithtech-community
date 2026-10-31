import { expect, test } from '../../fixtures/app';
import { FAITHTECH, NORTHSIDE } from '../../fixtures/mock-host';
import { NotAMemberPage } from '../../pages/not-a-member.page';
import { SignInPage } from '../../pages/sign-in.page';

// Traces to: L2-132 AC3 (docs/detailed-designs/organisations/accounts-and-memberships).
// The account is global, so it signs in on a host where it has no profile; the app then shows only the not-a-member
// page, and the API refuses everything else.

test.describe('Signed in where you are not a member', () => {
  test('the page names the organisation and links to the account’s other organisations', async ({
    page,
    api,
    axe,
  }) => {
    api.host.serve(NORTHSIDE);
    const notAMember = new NotAMemberPage(page);
    const account = api.addAccount({
      email: 'abena.owusu@example.org',
      organisations: [FAITHTECH],
    });

    await api.signInAs(account, '/not-a-member');

    await expect(notAMember.heading('Northside Makers')).toBeVisible();
    await expect(notAMember.lead).toContainText('abena.owusu@example.org');
    await expect(notAMember.yourOrganisations).toBeVisible();
    await expect(notAMember.membership('FaithTech Community')).toHaveAttribute(
      'href',
      `https://${FAITHTECH.host}`,
    );
    await axe.check();
  });

  test('with no other organisation there is nothing to link to', async ({ page, api, axe }) => {
    api.host.serve(NORTHSIDE);
    const notAMember = new NotAMemberPage(page);
    const account = api.addAccount({ email: 'lena.fischer@example.org', organisations: [] });

    await api.signInAs(account, '/not-a-member');

    await expect(notAMember.heading('Northside Makers')).toBeVisible();
    await expect(notAMember.yourOrganisations).toHaveCount(0);
    await axe.check();
  });

  test('every other page keeps a non-member out', async ({ page, api }) => {
    api.host.serve(NORTHSIDE);
    const notAMember = new NotAMemberPage(page);
    await api.signInAs(
      api.addAccount({ email: 'abena.owusu@example.org', organisations: [] }),
      '/not-a-member',
    );

    await notAMember.visit('/events');

    await expect(notAMember.heading('Northside Makers')).toBeVisible();
    expect(notAMember.path()).toBe('/not-a-member');
  });

  test('signing out goes back to sign in', async ({ page, api }) => {
    api.host.serve(NORTHSIDE);
    const notAMember = new NotAMemberPage(page);
    await api.signInAs(
      api.addAccount({ email: 'abena.owusu@example.org', organisations: [] }),
      '/not-a-member',
    );

    await notAMember.signOut.click();

    await expect(new SignInPage(page).heading).toBeVisible();
  });
});
