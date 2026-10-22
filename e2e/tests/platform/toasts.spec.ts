// Traces to: L2-044, L2-045 AC1 (docs/detailed-designs/platform/responsive-layout-and-theming,
// docs/design-system/components/toast.html: phone toasts clear the bottom tab bar).
import { expect, test } from '../../fixtures/app';
import { AppShell } from '../../pages/app-shell.page';
import { EditProfilePage } from '../../pages/edit-profile.page';
import { BREAKPOINTS } from '../../pages/viewport';

test.describe('Toasts', () => {
  for (const name of ['xs', 'sm'] as const) {
    test(`on a phone (${name}) a toast sits above the tab bar, which stays usable`, async ({
      page,
      api,
      axe,
    }) => {
      await page.setViewportSize(BREAKPOINTS[name]);
      const grace = api.addAccount({ email: 'grace@example.org', name: 'Grace Okonkwo' });
      const shell = new AppShell(page);
      const edit = new EditProfilePage(page);
      await api.signInAs(grace, '/people/me');
      await edit.open();
      await edit.save.click();

      await expect(edit.savedToast).toBeVisible();
      const tabBar = (await shell.tabBar.boundingBox())!;
      // Polled: the toast slides up 1rem as it enters.
      await expect
        .poll(async () => {
          const toast = (await shell.toasts.first().boundingBox())!;
          return toast.y + toast.height;
        })
        .toBeLessThanOrEqual(tabBar.y);
      await expect(shell.tab('Home')).toBeVisible();
      await axe.check();

      await shell.tab('Home').click();
      await expect(shell.tab('Home')).toHaveAttribute('aria-current', 'page');
    });
  }

  test('on desktop a toast keeps its bottom-right place', async ({ page, api }) => {
    await page.setViewportSize(BREAKPOINTS.xl);
    const grace = api.addAccount({ email: 'grace@example.org', name: 'Grace Okonkwo' });
    const shell = new AppShell(page);
    const edit = new EditProfilePage(page);
    await api.signInAs(grace, '/people/me');
    await edit.open();
    await edit.save.click();

    await expect(edit.savedToast).toBeVisible();
    const viewport = BREAKPOINTS.xl;
    // --space-6 (24px) from the right and bottom edges, polled while the toast slides in.
    await expect
      .poll(async () => {
        const toast = (await shell.toasts.first().boundingBox())!;
        return [
          Math.round(viewport.width - (toast.x + toast.width)),
          Math.round(viewport.height - (toast.y + toast.height)),
        ];
      })
      .toEqual([24, 24]);
  });
});
