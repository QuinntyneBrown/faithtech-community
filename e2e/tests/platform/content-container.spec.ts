// Traces to: L2-045 (docs/detailed-designs/platform/responsive-layout-and-theming;
// docs/mocks/pages/team/default.html: <main class="container">, 80rem wide with the layout margin).
import { expect, test } from '../../fixtures/app';
import { AppShell } from '../../pages/app-shell.page';
import { TeamPage } from '../../pages/team.page';
import { BREAKPOINTS, hasHorizontalScroll } from '../../pages/viewport';

// Content edges at each width: the container is at most 1280px wide, centred, and pads its
// content by --layout-margin (16px, 32px from 768px, 48px from 1024px).
const cases = [
  { name: 'xs', viewport: BREAKPOINTS.xs, left: 16, right: 375 - 16 },
  { name: 'sm', viewport: BREAKPOINTS.sm, left: 16, right: 640 - 16 },
  { name: 'md', viewport: BREAKPOINTS.md, left: 32, right: 768 - 32 },
  { name: 'lg', viewport: BREAKPOINTS.lg, left: 48, right: 1024 - 48 },
  { name: 'xl', viewport: BREAKPOINTS.xl, left: 48, right: 1280 - 48 },
  { name: '1440', viewport: { width: 1440, height: 900 }, left: 128, right: 1312 },
];

test.describe('Content container', () => {
  for (const c of cases) {
    test(`member pages sit in the content container at ${c.name}`, async ({ page, api }) => {
      await page.setViewportSize(c.viewport);
      const grace = api.addAccount({
        email: 'grace@example.org',
        name: 'Grace Okonkwo',
        roles: ['CityLead'],
      });
      await api.signInAs(grace, '/team');
      const team = new TeamPage(page);
      await expect(team.heading).toHaveText('Team');

      // The page header spans the content width.
      const content = (await new AppShell(page).pageHeader.boundingBox())!;
      expect(Math.round(content.x)).toBe(c.left);
      expect(Math.round(content.x + content.width)).toBe(c.right);
      const heading = (await team.heading.boundingBox())!;
      expect(Math.round(heading.x)).toBe(c.left);
      expect(await hasHorizontalScroll(page)).toBe(false);
    });
  }
});
