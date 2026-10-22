import { expect, test } from '../../fixtures/app';
import { MARKETING_URL, MarketingPage } from '../../pages/marketing.page';
import { PrivatePreviewPage } from '../../pages/private-preview.page';
import { SignInPage } from '../../pages/sign-in.page';
import { BREAKPOINTS, hasHorizontalScroll, undersizedTargets } from '../../pages/viewport';

// Traces to: L2-085, L2-086, L2-087, L2-088, L2-089, L2-093 (docs/detailed-designs/platform/private-preview-wall).
// The wall is the server's; the fake (fixtures/mock-wall.ts) serves the same wall.html, so this suite exercises the
// real page. Every other spec runs as the owner who has already unlocked.
test.describe('Private preview wall', () => {
  test.beforeEach(async ({ api }) => {
    await api.wall.lock();
  });

  for (const url of ['/', '/events', '/public/events/event-1', `${MARKETING_URL}/`]) {
    test(`a locked visitor at ${url} sees only the neutral wall`, async ({ page, axe }) => {
      const wall = new PrivatePreviewPage(page);

      await wall.open(url);

      await expect(wall.heading).toBeVisible();
      await expect(wall.lead).toBeVisible();
      await expect(wall.passphrase).toBeVisible();
      await expect(wall.unlock).toBeVisible();
      expect(await wall.title()).toBe('Private preview');
      await expect(wall.images).toHaveCount(0);
      expect(await wall.everything()).not.toMatch(
        /faithtech|community|\bft-|og:|name="description"/i,
      );
      await axe.check();
    });
  }

  for (const [name, viewport] of Object.entries(BREAKPOINTS)) {
    for (const colorScheme of ['light', 'dark'] as const) {
      test(`the wall fits at ${name} in ${colorScheme}`, async ({ page, axe }) => {
        const wall = new PrivatePreviewPage(page);
        await page.setViewportSize(viewport);
        await page.emulateMedia({ colorScheme });

        await wall.open('/');

        await expect(wall.heading).toBeVisible();
        expect(await hasHorizontalScroll(page)).toBe(false);
        expect(await undersizedTargets(page)).toEqual([]);
        await axe.check();
      });
    }
  }

  test('a wrong passphrase is refused the same way every time', async ({ page, axe }) => {
    const wall = new PrivatePreviewPage(page);
    await wall.open('/');

    await wall.unlockWith('not the passphrase');

    await expect(wall.refusal).toBeVisible();
    await expect(wall.passphrase).toHaveAttribute('aria-invalid', 'true');
    await expect(wall.passphrase).toBeFocused();
    await expect(wall.passphrase).toHaveValue('');
    await axe.check();
    const first = await wall.everything();

    await wall.unlockWith('');

    await expect(wall.refusal).toBeVisible();
    expect(normalise(await wall.everything())).toBe(normalise(first));
  });

  test('five refusals lock the visitor out, even for the right passphrase', async ({
    page,
    api,
    axe,
  }) => {
    const wall = new PrivatePreviewPage(page);
    await wall.open('/');
    for (let i = 0; i < 5; i++) await wall.unlockWith(`wrong ${i}`);

    await wall.unlockWith(api.wall.passphrase);

    await expect(wall.lockedOut).toBeVisible();
    await expect(wall.lockedOut).toContainText('Wait a few minutes, then try again.');
    await expect(wall.heading).toBeVisible();
    await axe.check();
  });

  test('the button shows it is checking, and further presses send nothing', async ({
    page,
    api,
  }) => {
    const wall = new PrivatePreviewPage(page);
    api.wall.holdAnswers = true;
    await wall.open('/');

    await wall.unlockWith('not the passphrase');

    await expect(wall.checking).toBeVisible();
    await expect(wall.checking).toHaveAttribute('aria-busy', 'true');
    await wall.checking.click({ force: true });
    expect(api.wall.submissions).toBe(1);
  });

  test('the correct passphrase reveals the unchanged marketing page, then the community app', async ({
    page,
    api,
  }) => {
    const wall = new PrivatePreviewPage(page);
    const marketing = new MarketingPage(page);
    const signIn = new SignInPage(page);
    await wall.open(`${MARKETING_URL}/`);

    await wall.unlockWith(api.wall.passphrase);

    await expect(marketing.heading).toBeVisible();
    await expect(marketing.eyebrow).toBeVisible();
    await signIn.open();
    await expect(signIn.heading).toBeVisible();
    await expect(wall.heading).toHaveCount(0);
  });

  test('unlocking returns the visitor to the page first asked for', async ({ page, api }) => {
    const wall = new PrivatePreviewPage(page);
    const signIn = new SignInPage(page);
    await wall.open('/sign-in');

    await wall.unlockWithKeyboard(api.wall.passphrase);

    await expect(signIn.heading).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/sign-in');
  });

  test('a forged unlock cookie does not get past the wall', async ({ page, api }) => {
    const wall = new PrivatePreviewPage(page);
    await api.wall.forgeUnlock('w1.4102444800.forged');

    await wall.open('/sign-in');

    await expect(wall.heading).toBeVisible();
  });
});

/** The page with its per-response nonce and CSRF value blanked, which differ on purpose. */
function normalise(html: string): string {
  return html
    .replace(/nonce="[^"]*"/g, 'nonce=""')
    .replace(/name="csrf" value="[^"]*"/g, 'name="csrf" value=""');
}
