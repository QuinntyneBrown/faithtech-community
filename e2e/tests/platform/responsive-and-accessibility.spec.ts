import { expect, test } from '../../fixtures/app';
import { SignInPage } from '../../pages/sign-in.page';
import {
  BREAKPOINTS,
  BreakpointName,
  hasHorizontalScroll,
  pageBackground,
  undersizedTargets,
} from '../../pages/viewport';

// L2-045 AC1, AC3 and L2-044 AC2 (docs/detailed-designs/platform/responsive-layout-and-theming
// and docs/detailed-designs/platform/accessibility).
const SCREENS = ['/sign-in', '/sign-up', '/forgot-password', '/verify-email', '/no/such/page'];

for (const name of Object.keys(BREAKPOINTS) as BreakpointName[]) {
  test(`no screen scrolls sideways and targets are at least 24px at ${name}`, async ({
    page,
    api,
  }) => {
    await page.setViewportSize(BREAKPOINTS[name]);

    for (const screen of SCREENS) {
      await page.goto(screen);
      await expect(page.locator('h1')).toBeVisible();
      expect(await hasHorizontalScroll(page), screen).toBe(false);
      expect(await undersizedTargets(page), screen).toEqual([]);
    }

    await api.signInAs(api.addAccount({ email: `grace-${name}@example.org` }));
    expect(await hasHorizontalScroll(page), 'home').toBe(false);
    expect(await undersizedTargets(page), 'home').toEqual([]);
  });
}

test('the dark theme follows the operating system', async ({ page, axe }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await new SignInPage(page).open();
  const light = await pageBackground(page);

  await page.emulateMedia({ colorScheme: 'dark' });

  await expect.poll(() => pageBackground(page)).not.toBe(light);
  await axe.check();
});

test('every sign-in control is reachable by keyboard with a visible focus', async ({ page }) => {
  const signIn = new SignInPage(page);
  await signIn.open();
  await expect(signIn.heading).toBeVisible();

  // Walk the tab order until focus leaves the page.
  const reached: string[] = [];
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press('Tab');
    const focus = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      if (el === document.body) return null;
      const style = getComputedStyle(el);
      const visible = style.outlineStyle !== 'none' || style.boxShadow !== 'none';
      return {
        name: el.getAttribute('aria-label') ?? el.textContent?.trim() ?? el.id,
        visible,
        tag: el.tagName,
      };
    });
    if (!focus) break;
    expect(focus.visible, `${focus.tag} ${focus.name}`).toBe(true);
    reached.push(focus.tag);
  }

  expect(reached.filter((t) => t === 'INPUT').length).toBeGreaterThanOrEqual(3);
  expect(reached).toContain('BUTTON');
});
