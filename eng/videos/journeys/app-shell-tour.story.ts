import { expect, test } from '../../../e2e/fixtures/app';
import { AppShell } from '../../../e2e/pages/app-shell.page';
import { Presenter } from '../presenter';

// Journey: the app shell (docs/detailed-designs/platform/responsive-layout-and-theming, L2-045).
// Viewports are capped at the video's 720px height, so phone and tablet frames are not scaled.
const DESKTOP = { width: 1280, height: 720 };
const TABLET = { width: 768, height: 720 };
const PHONE = { width: 390, height: 720 };

test('app-shell-tour', async ({ page, api }) => {
  const show = await Presenter.start(page, 'app-shell-tour');
  const shell = new AppShell(page);
  const account = api.addAccount({ name: 'Grace Okonkwo', email: 'grace@example.org' });

  await show.card(
    'opening',
    'opening',
    [
      'Phone, tablet and desktop · light and dark · keyboard',
      'Recorded against a local fake API · synthetic data',
    ],
    () => api.signInAs(account),
  );

  await show.step(
    'desktop',
    async () => {
      for (const name of ['Home', 'Events', 'Contacts', 'Partners', 'Team', 'People']) {
        await expect(shell.navLink(name)).toBeVisible();
      }
      await expect(shell.navLink('Home')).toHaveAttribute('aria-current', 'page');
    },
    { poster: true },
  );

  await show.step('tablet', async () => {
    await page.setViewportSize(TABLET);
    await expect(shell.navLink('Events')).toBeVisible();
  });

  await show.step(
    'phone',
    async () => {
      await page.setViewportSize(PHONE);
      await expect(shell.tabBar).toBeVisible();
      await expect(shell.menuButton).toBeVisible();
    },
    { position: 'top' },
  );

  await show.step(
    'drawer',
    async () => {
      await shell.menuButton.click();
      await expect(shell.drawer).toBeVisible();
      await expect(shell.drawerLink('Announcements')).toBeVisible();
      await page.waitForTimeout(2500);
      for (let i = 0; i < 4; i++) {
        await page.keyboard.press('Tab');
        await page.waitForTimeout(700);
      }
      expect(await shell.drawer.evaluate((d) => d.contains(document.activeElement))).toBe(true);
      await page.waitForTimeout(1500);
      await page.keyboard.press('Escape');
      await expect(shell.drawer).toBeHidden();
      await expect(shell.menuButton).toBeFocused();
    },
    { position: 'bottom' },
  );

  await show.step('dark-theme', async () => {
    await page.setViewportSize(DESKTOP);
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(shell.navLink('Home')).toBeVisible();
  });

  await show.step('light-theme', async () => {
    await page.emulateMedia({ colorScheme: 'light' });
  });

  await show.step('keyboard', async () => {
    await page.mouse.click(DESKTOP.width / 2, DESKTOP.height / 2);
    await page.keyboard.press('Tab');
    await expect(shell.skipLink).toBeFocused();
    await page.waitForTimeout(1500);
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(700);
    }
  });

  await show.card('closing', 'closing', [
    'One layout from phone to desktop',
    'Follows your device’s light or dark theme',
    'Fully usable from the keyboard',
  ]);
  await show.finish();
});
