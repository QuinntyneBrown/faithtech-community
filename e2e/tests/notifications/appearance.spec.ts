import { expect, test } from '../../fixtures/app';
import { SettingsPage } from '../../pages/settings.page';
import { pageBackground } from '../../pages/viewport';

// L2-045 AC6 (docs/detailed-designs/platform/responsive-layout-and-theming).
test.describe('Appearance setting', () => {
  test('a member forces the dark theme, and it is remembered on this device', async ({
    page,
    api,
    axe,
  }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    const settings = new SettingsPage(page);
    await api.signInAs(api.addAccount({ email: 'grace@example.org' }), '/settings');

    await expect(settings.heading).toBeVisible();
    await expect(settings.theme('Match my device')).toBeChecked();
    const light = await pageBackground(page);

    await settings.chooseTheme('Dark');

    expect(await settings.forcedTheme()).toBe('dark');
    await expect.poll(() => pageBackground(page)).not.toBe(light);
    await axe.check();

    await page.reload();
    await expect(settings.theme('Dark')).toBeChecked();
    expect(await settings.forcedTheme()).toBe('dark');
  });

  test('Match my device follows the operating system again', async ({ page, api }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    const settings = new SettingsPage(page);
    await api.signInAs(api.addAccount({ email: 'grace@example.org' }), '/settings');

    await settings.chooseTheme('Light');
    expect(await settings.forcedTheme()).toBe('light');

    await settings.chooseTheme('Match my device');
    expect(await settings.forcedTheme()).toBeNull();
    await expect(settings.theme('Match my device')).toBeChecked();
  });
});
