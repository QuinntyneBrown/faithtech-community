// Traces to: L2-045 (docs/detailed-designs/platform/responsive-layout-and-theming;
// docs/mocks/pages/team/default.html: the page title is the h1 type role).
import { expect, test } from '../../fixtures/app';
import { AdminUsersPage } from '../../pages/admin-users.page';
import { InvitesPage } from '../../pages/invites.page';
import { TeamPage } from '../../pages/team.page';
import { referenceHeading, typography } from '../../pages/type-role';
import { BREAKPOINTS, hasHorizontalScroll } from '../../pages/viewport';

test.describe('Page header', () => {
  for (const size of ['xs', 'xl'] as const) {
    test(`page titles use the h1 type role at ${size}`, async ({ page, api }) => {
      await page.setViewportSize(BREAKPOINTS[size]);
      const priya = api.addAccount({
        email: 'priya@example.org',
        name: 'Priya Shah',
        roles: ['SystemAdmin', 'CityLead'],
      });

      await api.signInAs(priya, '/team');
      const team = new TeamPage(page);
      await expect(team.heading).toHaveText('Team');
      const h1 = await referenceHeading(page, 'h1');
      expect(await typography(team.heading)).toEqual(h1);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);

      const invites = new InvitesPage(page);
      await invites.open();
      await expect(invites.heading).toHaveText('Invites');
      expect(await typography(invites.heading)).toEqual(h1);

      const users = new AdminUsersPage(page);
      await page.goto('/admin/users');
      await expect(users.heading).toBeVisible();
      expect(await typography(users.heading)).toEqual(h1);
      expect(await hasHorizontalScroll(page)).toBe(false);
    });
  }
});
