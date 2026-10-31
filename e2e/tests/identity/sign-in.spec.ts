import { expect, test } from '../../fixtures/app';
import { SignInPage } from '../../pages/sign-in.page';

// L2-003: sign in with authorization code + PKCE (docs/detailed-designs/identity/sign-in-and-sign-out).
test.describe('Sign in', () => {
  test('a signed-out visitor is sent to sign in and lands on the page they asked for', async ({
    page,
    api,
    axe,
  }) => {
    const account = api.addAccount({ email: 'grace@example.org' });
    const signIn = new SignInPage(page);

    await page.goto('/events');
    await expect(signIn.heading).toBeVisible();
    await axe.check();

    await signIn.signIn(account.email, account.password);

    await expect(page).toHaveURL(/\/events$/);
    const exchange = api.callsTo('POST', '/connect/token')[0];
    expect(exchange.body['grant_type']).toBe('authorization_code');
    expect(String(exchange.body['code_verifier'])).toMatch(/^[A-Za-z0-9_-]{43,}$/);
  });

  test('signing in directly lands on the home page', async ({ page, api }) => {
    const account = api.addAccount({ email: 'grace@example.org' });
    const signIn = new SignInPage(page);

    await signIn.open();
    await signIn.signIn(account.email, account.password);

    await expect(page).toHaveURL(/\/$/);
  });

  test('wrong credentials show a generic error on the form', async ({ page, api, axe }) => {
    api.addAccount({ email: 'grace@example.org' });
    const signIn = new SignInPage(page);

    await signIn.open();
    await signIn.signIn('grace@example.org', 'not-the-password');

    await expect(signIn.alert).toContainText('We couldn’t sign you in');
    await expect(signIn.passwordError).toHaveText(
      'Email or password is wrong. Check both and try again.',
    );
    await expect(signIn.alert).toBeFocused();
    await axe.check();
  });

  test('a locked account is told to wait 15 minutes', async ({ page, api }) => {
    api.addAccount({ email: 'grace@example.org' });
    const signIn = new SignInPage(page);
    await signIn.open();

    for (let i = 0; i < 6; i++) {
      await signIn.signIn('grace@example.org', 'not-the-password');
    }

    await expect(signIn.alert).toContainText('Too many attempts');
    await expect(signIn.alert).toContainText('15 minutes');
  });

  test('a suspended account is refused', async ({ page, api, axe }) => {
    const account = api.addAccount({
      email: 'grace@example.org',
      suspended: true,
    });
    const signIn = new SignInPage(page);

    await signIn.open();
    await signIn.signIn(account.email, account.password);

    await expect(signIn.alert).toContainText('Your membership of FaithTech Community is suspended');
    await axe.check();
  });

  test('empty fields get inline errors and focus moves to the first one', async ({ page }) => {
    const signIn = new SignInPage(page);

    await signIn.open();
    await signIn.submitEmpty();

    await expect(signIn.emailError).toHaveText('Enter your email address.');
    await expect(signIn.passwordError).toHaveText('Enter your password.');
    await expect(signIn.email).toBeFocused();
  });

  test('the refresh token lasts only for the browser session unless kept signed in', async ({
    page,
    api,
  }) => {
    const account = api.addAccount({ email: 'grace@example.org' });
    const signIn = new SignInPage(page);

    await signIn.open();
    await signIn.signIn(account.email, account.password);
    await expect(page).toHaveURL(/\/$/);
    expect(await signIn.storedRefreshToken('sessionStorage')).toBe('refresh-token');
    expect(await signIn.storedRefreshToken('localStorage')).toBeNull();
  });

  test('keep me signed in stores the refresh token on the device', async ({ page, api }) => {
    const account = api.addAccount({ email: 'grace@example.org' });
    const signIn = new SignInPage(page);

    await signIn.open();
    await signIn.signIn(account.email, account.password, {
      keepSignedIn: true,
    });
    await expect(page).toHaveURL(/\/$/);

    expect(await signIn.storedRefreshToken('localStorage')).toBe('refresh-token');
  });
});
