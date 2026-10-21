// Traces to: L2-005, L2-006, L2-007 with L2-045 AC1 (docs/detailed-designs/platform/responsive-layout-and-theming)
import { expect, test } from '../../fixtures/app';
import { photoUrl } from '../../fixtures/mock-api';
import { EditProfilePage } from '../../pages/edit-profile.page';
import { ProfilePage } from '../../pages/profile.page';
import {
  BREAKPOINTS,
  BreakpointName,
  hasHorizontalScroll,
  undersizedTargets,
} from '../../pages/viewport';

for (const name of Object.keys(BREAKPOINTS) as BreakpointName[]) {
  test(`the profile screens fit and keep 24px targets at ${name}`, async ({ page, api }) => {
    await page.setViewportSize(BREAKPOINTS[name]);
    const grace = api.addAccount({ email: 'grace@example.org', name: 'Grace Okonkwo' });
    api.profiles.get(grace.profileId)!.photos = Array.from({ length: 4 }, (_, i) => ({
      id: `photo-${i}`,
      url: photoUrl(),
      altText: `Photo ${i}`,
      isFeatured: i === 0,
      uploadedAt: `2026-10-0${i + 1}T10:00:00Z`,
    }));
    await api.signInAs(grace, '/people/me');

    await expect(new ProfilePage(page).heading).toHaveText('Grace Okonkwo');
    expect(await hasHorizontalScroll(page), 'profile').toBe(false);
    expect(await undersizedTargets(page), 'profile').toEqual([]);

    await new EditProfilePage(page).open();
    await expect(new EditProfilePage(page).photoItems).toHaveCount(4);
    expect(await hasHorizontalScroll(page), 'edit profile').toBe(false);
    expect(await undersizedTargets(page), 'edit profile').toEqual([]);
  });
}
