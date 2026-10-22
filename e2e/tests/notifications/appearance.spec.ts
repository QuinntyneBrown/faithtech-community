import { expect, test } from '../../fixtures/app';
import { SettingsPage } from '../../pages/settings.page';
import { TeamPage } from '../../pages/team.page';
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

  test('a saved theme applies from the first page loaded, not only on Settings', async ({
    page,
    api,
  }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    const settings = new SettingsPage(page);
    await api.signInAs(api.addAccount({ email: 'grace@example.org' }), '/settings');
    await settings.chooseTheme('Dark');
    const dark = await pageBackground(page);

    // A fresh load of another page, the way a member comes back the next day.
    const team = new TeamPage(page);
    await page.goto('/team');
    await expect(team.heading).toBeVisible();
    expect(await settings.forcedTheme()).toBe('dark');
    expect(await pageBackground(page)).toBe(dark);
  });

  test('with storage blocked, choosing a theme still changes it for the session', async ({
    page,
    api,
  }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    // Storage refuses the theme (as in a locked-down browser); sign-in keeps working.
    await page.addInitScript(() => {
      const { getItem, setItem } = Storage.prototype;
      Storage.prototype.getItem = function (key: string) {
        if (key === 'ft-theme') throw new DOMException('Blocked', 'SecurityError');
        return getItem.call(this, key);
      };
      Storage.prototype.setItem = function (key: string, value: string) {
        if (key === 'ft-theme') throw new DOMException('Blocked', 'SecurityError');
        return setItem.call(this, key, value);
      };
    });
    const settings = new SettingsPage(page);
    await api.signInAs(api.addAccount({ email: 'grace@example.org' }), '/settings');

    await settings.chooseTheme('Dark');

    expect(await settings.forcedTheme()).toBe('dark');
    await expect(settings.theme('Dark')).toBeChecked();
  });
});
