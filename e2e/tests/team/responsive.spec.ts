// Traces to: L2-019 with L2-045 AC1 (docs/detailed-designs/platform/responsive-layout-and-theming)
import { expect, test } from '../../fixtures/app';
import { TeamPage } from '../../pages/team.page';
import {
  BREAKPOINTS,
  BreakpointName,
  hasHorizontalScroll,
  undersizedTargets,
} from '../../pages/viewport';

for (const name of Object.keys(BREAKPOINTS) as BreakpointName[]) {
  test(`the team page fits and keeps 24px targets at ${name}`, async ({ page, api }) => {
    await page.setViewportSize(BREAKPOINTS[name]);
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    api.profiles.get(grace.profileId)!.chapterId = api.chapters.named('Toronto').id;
    api.addProfile({
      name: 'Samuel Mensah',
      chapterId: api.chapters.named('Toronto').id,
      roles: ['CreateLead', 'ProductEngineer', 'Volunteer'],
    });

    await api.signInAs(grace, '/team');
    const team = new TeamPage(page);
    await expect(team.member('Samuel Mensah')).toBeVisible();
    expect(await hasHorizontalScroll(page), 'team').toBe(false);
    expect(await undersizedTargets(page), 'team').toEqual([]);
  });
}
