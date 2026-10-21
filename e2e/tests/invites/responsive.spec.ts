// Traces to: L2-010, L2-011 with L2-045 AC1 (docs/detailed-designs/platform/responsive-layout-and-theming)
import { expect, test } from '../../fixtures/app';
import { AcceptInvitePage } from '../../pages/accept-invite.page';
import { InvitesPage } from '../../pages/invites.page';
import {
  BREAKPOINTS,
  BreakpointName,
  hasHorizontalScroll,
  undersizedTargets,
} from '../../pages/viewport';

for (const name of Object.keys(BREAKPOINTS) as BreakpointName[]) {
  test(`the invite screens fit and keep 24px targets at ${name}`, async ({ page, api }) => {
    await page.setViewportSize(BREAKPOINTS[name]);
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    api.addInvite({
      email: 'nate.oyelaran@example.org',
      invitedBy: grace.profileId,
      preassignedRole: 'ProductEngineer',
    });
    const expired = api.addInvite(
      { email: 'felix.wu@example.org', invitedBy: grace.profileId },
      20,
    );
    const pending = api.addInvite({
      email: 'ruth.alvarez@example.org',
      invitedBy: grace.profileId,
      preassignedRole: 'Volunteer',
    });

    const accept = new AcceptInvitePage(page);
    await accept.open(pending.token);
    await expect(accept.heading).toHaveText('You’re invited');
    expect(await hasHorizontalScroll(page), 'accept invite').toBe(false);
    expect(await undersizedTargets(page), 'accept invite').toEqual([]);

    await api.signInAs(grace, '/invites');
    await expect(new InvitesPage(page).resend(expired.email)).toBeVisible();
    expect(await hasHorizontalScroll(page), 'invites').toBe(false);
    expect(await undersizedTargets(page), 'invites').toEqual([]);
  });
}
