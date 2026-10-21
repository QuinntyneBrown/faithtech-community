import { expect, test } from '../../fixtures/app';
import { SignUpPage } from '../../pages/sign-up.page';
import { VerifyEmailPage } from '../../pages/verify-email.page';

// L2-043 AC2: user-entered text is encoded and script injection does not execute.
const PAYLOAD = '<img src=x onerror="window.__injected=true">';
// No whitespace, so it passes the form's email check and reaches the screen that shows it.
const EMAIL_PAYLOAD = '<img/src=x/onerror=window.__injected=true>@example.org';

test.describe('Output encoding', () => {
  test('text from the address bar is shown as text, not run', async ({ page }) => {
    const verify = new VerifyEmailPage(page);

    await verify.openPending(PAYLOAD);

    await expect(verify.sentTo(PAYLOAD)).toBeVisible();
    expect(
      await page.evaluate(() => (window as { __injected?: boolean }).__injected),
    ).toBeUndefined();
    await expect(page.locator('img[src="x"]')).toHaveCount(0);
  });

  test('text typed into a form is shown as text, not run', async ({ page }) => {
    const signUp = new SignUpPage(page);
    await signUp.open();

    await signUp.create('Leah', EMAIL_PAYLOAD, 'a-long-enough-passphrase');

    await expect(signUp.checkInbox).toBeVisible();
    await expect(signUp.sentTo(EMAIL_PAYLOAD)).toBeVisible();
    expect(
      await page.evaluate(() => (window as { __injected?: boolean }).__injected),
    ).toBeUndefined();
  });
});
