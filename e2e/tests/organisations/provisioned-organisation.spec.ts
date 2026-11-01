// Traces to: L2-149 AC2, AC5; L2-134 AC5 (docs/detailed-designs/organisations/platform-operations)
import { expect, test } from '../../fixtures/app';
import { MockOrganisation } from '../../fixtures/mock-host';
import { AcceptInvitePage } from '../../pages/accept-invite.page';
import { ComposeAnnouncementPage } from '../../pages/compose-announcement.page';
import { InvitesPage } from '../../pages/invites.page';
import { OrganisationGeneralPage } from '../../pages/organisation-general.page';
import { ProfilePage } from '../../pages/profile.page';
import { AddResourceDialog } from '../../pages/resource.dialogs';
import { ResourcesPage } from '../../pages/resources.page';

// An organisation just provisioned by an operator: its defaults only, and no chapters.
const RIVERSIDE: MockOrganisation = {
  slug: 'riverside',
  name: 'Riverside Church',
  shortName: 'Riverside',
  host: 'app.riverside.test',
  chapterLabel: null,
  marketing: { headline: 'Riverside Church', brochure: null, footer: '© 2026 Riverside Church' },
};

test.describe('A provisioned organisation', () => {
  test('the first administrator accepts the operator’s invite and opens the Organisation section', async ({
    page,
    api,
    axe,
  }) => {
    api.provision(RIVERSIDE);
    const invite = api.addProvisioningInvite('joel@riverside.test');
    const accept = new AcceptInvitePage(page);

    await accept.open(invite.token);

    await expect(accept.invitation).toContainText(
      'A Riverside lead invited you to join Riverside as a Administrator',
    );
    await expect(accept.email).toHaveValue('joel@riverside.test');
    await axe.check();

    await accept.name.fill('Joel Mwangi');
    await accept.password.fill('a-long-enough-passphrase');
    await accept.acceptAndJoin.click();

    await expect(page).toHaveURL(/\/people\/me$/);
    await expect(new ProfilePage(page).heading).toHaveText('Joel Mwangi');

    const general = new OrganisationGeneralPage(page);
    await general.open();
    await expect(general.heading).toHaveText('Riverside Church');
    await expect(general.value('Short name')).toHaveText('Riverside');
    await expect(general.edit).toBeVisible();
    await expect(general.readOnly).toHaveCount(0);
    await axe.check();
  });

  // Traces to: L2-151 AC5 sweep; L2-061 AC1; L2-029 AC1; L2-010 (docs/detailed-designs/organisations/seed-faithtech)
  test('its own roles label invites and fill the share and audience pickers', async ({
    page,
    api,
    axe,
  }) => {
    api.provision(RIVERSIDE);
    const joel = api.addAccount({
      email: 'joel@riverside.test',
      name: 'Joel Mwangi',
      roles: ['administrator'],
    });
    api.addInvite({
      email: 'ana@riverside.test',
      invitedBy: joel.profileId,
      preassignedRole: 'member',
    });
    await api.signInAs(joel, '/invites');

    await expect(new InvitesPage(page).item('ana@riverside.test')).toContainText('Member');

    const resources = new ResourcesPage(page);
    await resources.open();
    await resources.addFirst.click();
    const dialog = new AddResourceDialog(page);
    await dialog.visibility('Shared').check();
    await expect(dialog.roles).toHaveText(['Administrator', 'Member']);
    await axe.check();
    await page.keyboard.press('Escape');

    const compose = new ComposeAnnouncementPage(page);
    await page.goto('/announcements/new');
    await compose.chooseAudience('People with a role');
    await expect(compose.roleOptions).toHaveText(['Administrator', 'Member']);
    await axe.check();
  });
});
