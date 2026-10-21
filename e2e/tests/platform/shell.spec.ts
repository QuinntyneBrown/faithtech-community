import { expect, test } from '../../fixtures/app';
import { AppShell } from '../../pages/app-shell.page';
import { SignInPage } from '../../pages/sign-in.page';
import { BREAKPOINTS } from '../../pages/viewport';

// L2-045 AC2 and L2-003 AC6 (docs/detailed-designs/platform/responsive-layout-and-theming).
test.describe('App shell', () => {
  test('above XS the top bar shows the sections', async ({ page, api, axe }) => {
    await page.setViewportSize(BREAKPOINTS.xl);
    const shell = new AppShell(page);

    await api.signInAs(api.addAccount({ email: 'grace@example.org' }));

    for (const name of ['Home', 'Events', 'Contacts', 'Partners', 'Team', 'People']) {
      await expect(shell.navLink(name)).toBeVisible();
    }
    await expect(shell.navLink('Home')).toHaveAttribute('aria-current', 'page');
    await expect(shell.menuButton).toBeHidden();
    await expect(shell.tabBar).toBeHidden();
    await axe.check();
  });

  test('at XS the navigation collapses into a menu that traps and returns focus', async ({
    page,
    api,
    axe,
  }) => {
    await page.setViewportSize(BREAKPOINTS.xs);
    const shell = new AppShell(page);
    await api.signInAs(api.addAccount({ email: 'grace@example.org' }));

    await expect(shell.navLink('Events')).toBeHidden();
    await expect(shell.tabBar).toBeVisible();
    await shell.menuButton.click();

    await expect(shell.drawer).toBeVisible();
    for (const name of [
      'Home',
      'Events',
      'Contacts',
      'Partners',
      'Team',
      'Announcements',
      'People',
    ]) {
      await expect(shell.drawerLink(name)).toBeVisible();
    }
    await axe.check();
    for (let i = 0; i < 12; i++) await page.keyboard.press('Tab');
    expect(await shell.drawer.evaluate((d) => d.contains(document.activeElement))).toBe(true);

    await page.keyboard.press('Escape');
    await expect(shell.drawer).toBeHidden();
    await expect(shell.menuButton).toBeFocused();
  });

  test('the skip link is the first thing keyboard users reach', async ({ page, api }) => {
    await api.signInAs(api.addAccount({ email: 'grace@example.org' }));

    await page.keyboard.press('Tab');

    await expect(new AppShell(page).skipLink).toBeFocused();
  });

  test('signing out revokes the session and returns to sign in', async ({ page, api }) => {
    const shell = new AppShell(page);
    await api.signInAs(api.addAccount({ email: 'grace@example.org' }));

    await shell.signOut.click();

    await expect(new SignInPage(page).heading).toBeVisible();
    expect(api.callsTo('POST', '/api/account/sign-out')[0]).toBeTruthy();
    await page.goto('/');
    await expect(new SignInPage(page).heading).toBeVisible();
  });
});
