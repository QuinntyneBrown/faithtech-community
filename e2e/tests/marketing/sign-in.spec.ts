import { expect, test } from '../../fixtures/app';
import { AppShell } from '../../pages/app-shell.page';
import { MarketingPage } from '../../pages/marketing.page';
import { SignInPage } from '../../pages/sign-in.page';

// Traces to: L2-057 (docs/detailed-designs/marketing/landing-page). Each outcome of L2-003.
test.describe('Sign in from the marketing page', () => {
  test('a verified account lands on the community app home with a PKCE session', async ({
    page,
    api,
    axe,
  }) => {
    const account = api.addAccount({ email: 'grace@example.org' });
    const marketing = new MarketingPage(page);
    await marketing.open();
    await expect(marketing.signInHeading).toBeVisible();
    await axe.check();

    await marketing.signIn(account.email, account.password);

    await expect(page).toHaveURL('http://localhost:4200/');
    const exchange = api.callsTo('POST', '/connect/token')[0];
    expect(exchange.body['grant_type']).toBe('authorization_code');
    expect(String(exchange.body['code_verifier'])).toMatch(/^[A-Za-z0-9_-]{43,}$/);
  });

  test('a returnUrl lands on that community app page', async ({ page, api }) => {
    const account = api.addAccount({ email: 'grace@example.org' });
    const marketing = new MarketingPage(page);
    await marketing.open('?returnUrl=%2Fevents');

    await marketing.signIn(account.email, account.password);

    await expect(page).toHaveURL('http://localhost:4200/events');
  });

  test('wrong credentials show the generic error and keep the details', async ({
    page,
    api,
    axe,
  }) => {
    api.addAccount({ email: 'grace@example.org' });
    const marketing = new MarketingPage(page);
    await marketing.open();

    await marketing.signIn('grace@example.org', 'not-the-password');

    await expect(marketing.alert).toContainText('We couldn’t sign you in');
    await expect(marketing.passwordError).toHaveText(
      'Email or password is wrong. Check both and try again.',
    );
    await expect(marketing.alert).toBeFocused();
    await expect(marketing.email).toHaveValue('grace@example.org');
    await axe.check();
  });

  test('a locked account is told to wait, with a way to reset the password', async ({
    page,
    api,
  }) => {
    api.addAccount({ email: 'grace@example.org' });
    const marketing = new MarketingPage(page);
    await marketing.open();

    for (let i = 0; i < 6; i++) {
      await marketing.signIn('grace@example.org', 'not-the-password');
    }

    await expect(marketing.alert).toContainText('Too many attempts');
    await expect(marketing.resetPassword).toHaveAttribute(
      'href',
      'http://localhost:4200/forgot-password',
    );
  });

  test('a suspended account is refused', async ({ page, api, axe }) => {
    const account = api.addAccount({ email: 'grace@example.org', suspended: true });
    const marketing = new MarketingPage(page);
    await marketing.open();

    await marketing.signIn(account.email, account.password);

    await expect(marketing.alert).toContainText('This account is suspended');
    await axe.check();
  });

  test('an unverified account lands in the app, which asks to verify the email', async ({
    page,
    api,
  }) => {
    const account = api.addAccount({ email: 'leah@example.org', verified: false });
    const marketing = new MarketingPage(page);
    await marketing.open();

    await marketing.signIn(account.email, account.password);

    await expect(new AppShell(page).verifyBanner).toContainText(
      'We sent a link to leah@example.org',
    );
  });

  test('the session lasts only for the browser session unless kept signed in', async ({
    page,
    api,
  }) => {
    const account = api.addAccount({ email: 'grace@example.org' });
    const marketing = new MarketingPage(page);
    await marketing.open();

    await marketing.signIn(account.email, account.password);

    await expect(page).toHaveURL('http://localhost:4200/');
    const appSignIn = new SignInPage(page);
    expect(await appSignIn.storedRefreshToken('sessionStorage')).toBe('refresh-token');
    expect(await appSignIn.storedRefreshToken('localStorage')).toBeNull();
  });

  test('keep me signed in keeps the session on the device', async ({ page, api }) => {
    const account = api.addAccount({ email: 'grace@example.org' });
    const marketing = new MarketingPage(page);
    await marketing.open();

    await marketing.signIn(account.email, account.password, { keepSignedIn: true });

    await expect(page).toHaveURL('http://localhost:4200/');
    expect(await new SignInPage(page).storedRefreshToken('localStorage')).toBe('refresh-token');
  });

  test('empty fields get inline errors and focus moves to the first one', async ({ page }) => {
    const marketing = new MarketingPage(page);
    await marketing.open();

    await marketing.submitEmptySignIn();

    await expect(marketing.emailError).toHaveText('Enter your email address.');
    await expect(marketing.passwordError).toHaveText('Enter your password.');
    await expect(marketing.email).toBeFocused();
  });

  test('an unreachable API is reported and the details are kept', async ({ page, api }) => {
    api.on('POST', '/api/account/sign-in', (route) => route.abort('failed'));
    const marketing = new MarketingPage(page);
    await marketing.open();

    await marketing.email.fill('grace@example.org');
    await marketing.password.fill('a-long-enough-passphrase');
    await marketing.signInButton.click();

    await expect(marketing.alert).toContainText('We couldn’t reach FaithTech');
    await expect(marketing.email).toHaveValue('grace@example.org');
  });

  test('the sign-in button is busy while the details are checked', async ({ page, api }) => {
    const account = api.addAccount({ email: 'grace@example.org' });
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    api.on('POST', '/api/account/sign-in', async (route) => {
      await held;
      await api.fallback(route);
    });
    const marketing = new MarketingPage(page);
    await marketing.open();

    await marketing.email.fill(account.email);
    await marketing.password.fill(account.password);
    await marketing.signInButton.click();

    await expect(marketing.signInButton).toHaveAttribute('aria-busy', 'true');
    release();
    await expect(page).toHaveURL('http://localhost:4200/');
  });
});
