import { expect, test } from '../../../e2e/fixtures/app';
import { MockWall } from '../../../e2e/fixtures/mock-wall';
import { PrivatePreviewPage } from '../../../e2e/pages/private-preview.page';
import { SignInPage } from '../../../e2e/pages/sign-in.page';
import { SignUpPage } from '../../../e2e/pages/sign-up.page';
import { BREAKPOINTS } from '../../../e2e/pages/viewport';
import { Presenter, typeInto } from '../presenter';

// Text that would run as script if the app put it on the page as HTML (L2-043).
const PAYLOAD = '<img/src=x/onerror=window.__injected=true>@example.org';

// Journey: use a fast, accessible, secure site (docs/detailed-designs/platform: private-preview-wall, accessibility,
// responsive-layout; L2-043, L2-044, L2-100 to L2-104). The shell tour and the error pages have their own videos.
test('fast-accessible-secure-site', async ({ page, api, baseURL }) => {
  const show = await Presenter.start(page, 'fast-accessible-secure-site');
  const wall = new PrivatePreviewPage(page);
  const signUp = new SignUpPage(page);
  const signIn = new SignInPage(page);
  // The recorder serves the app on its own origin, so the wall stands there rather than on the e2e hosts.
  const lock = new MockWall(page, [new URL(baseURL!).origin]);
  await lock.lock();

  await show.card(
    'opening',
    'opening',
    ['A fast, accessible, secure site', 'Recorded against a local fake API · synthetic people'],
    () => wall.open('/sign-up'),
  );

  await show.step('wall', async () => {
    await expect(wall.heading).toBeVisible();
    await expect(wall.images).toHaveCount(0);
  });

  await show.step('refused', async () => {
    await typeInto(wall.passphrase, 'open sesame');
    await wall.unlock.click();
    await expect(wall.refusal).toBeVisible();
    await expect(wall.passphrase).toBeFocused();
  });

  await show.step('unlocked', async () => {
    await typeInto(wall.passphrase, lock.passphrase);
    await page.keyboard.press('Enter');
    await expect(signUp.name).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/sign-up');
  });

  await show.step(
    'validated',
    async () => {
      await signUp.submit.click();
      await expect(signUp.summary).toContainText('Fix 3 things to create your account');
      await expect(signUp.nameError).toBeVisible();
    },
    { poster: true },
  );

  await show.step('encoded', async () => {
    await typeInto(signUp.name, 'Leah Park');
    await signUp.email.fill(PAYLOAD);
    await typeInto(signUp.password, 'a-long-enough-passphrase');
    await signUp.submit.click();
    await expect(signUp.checkInbox).toBeVisible();
    await expect(signUp.sentTo(PAYLOAD)).toBeVisible();
    expect(
      await page.evaluate(() => (window as { __injected?: boolean }).__injected),
    ).toBeUndefined();
  });

  await show.step('keyboard', async () => {
    await signIn.open();
    await expect(signIn.heading).toBeVisible();
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(700);
    }
  });

  await show.step('dark', async () => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(signIn.heading).toBeVisible();
  });

  await show.step('phone', async () => {
    await page.setViewportSize(BREAKPOINTS.xs);
    await expect(signIn.heading).toBeVisible();
  });

  await show.card('closing', 'closing', [
    'A wall in front of the private preview',
    'Clear errors, and text that stays text',
    'Keyboard, dark mode and phones on every screen',
  ]);
  await show.finish();
});
