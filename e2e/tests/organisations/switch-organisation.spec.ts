import { expect, test } from '../../fixtures/app';
import { FAITHTECH, NORTHSIDE } from '../../fixtures/mock-host';
import { AppShell } from '../../pages/app-shell.page';

// Traces to: L2-133 AC3, AC4 (docs/detailed-designs/organisations/accounts-and-memberships, docs/mocks/pages/account-menu).
// The account menu lists the member's other organisations; each starts sign-in on that organisation's host.

test.describe('Switch organisation', () => {
  test('a member of two organisations can switch to the other', async ({ page, api, axe }) => {
    const shell = new AppShell(page);
    await api.signInAs(
      api.addAccount({
        email: 'grace@example.org',
        name: 'Grace Okonkwo',
        organisations: [FAITHTECH, NORTHSIDE],
      }),
      '/events',
    );

    await shell.accountMenu('Grace Okonkwo').click();

    await expect(shell.switchOrganisation).toBeVisible();
    await expect(shell.organisationToSwitchTo('Northside Makers')).toHaveAttribute(
      'href',
      `https://${NORTHSIDE.host}/auth/continue?returnUrl=/`,
    );
    await expect(shell.organisationToSwitchTo('Northside Makers')).toContainText(NORTHSIDE.host);
    await expect(shell.organisationToSwitchTo('FaithTech Community')).toHaveCount(0);
    await axe.check();
  });

  test('a member of one organisation has nothing to switch to', async ({ page, api, axe }) => {
    const shell = new AppShell(page);
    await api.signInAs(
      api.addAccount({ email: 'grace@example.org', name: 'Grace Okonkwo', roles: ['Volunteer'] }),
      '/events',
    );

    await shell.accountMenu('Grace Okonkwo').click();

    await expect(shell.menuItem('Sign out')).toBeVisible();
    await expect(shell.switchOrganisation).toHaveCount(0);
    await axe.check();
  });
});
