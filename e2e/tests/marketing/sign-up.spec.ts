import { expect, test } from '../../fixtures/app';
import { MarketingPage } from '../../pages/marketing.page';

// Traces to: L2-058, L2-055 AC5 (docs/detailed-designs/marketing/landing-page). Each outcome of L2-001.
test.describe('Sign up from the marketing page', () => {
  test('Join now shows the join form without leaving the page, and Sign in switches back', async ({
    page,
    axe,
  }) => {
    const marketing = new MarketingPage(page);
    await marketing.open();

    await marketing.topBarJoin.click();

    await expect(marketing.joinHeading).toBeVisible();
    await expect(page).toHaveURL(/^http:\/\/localhost:4300\/\?join/);
    await axe.check();
    await marketing.panelSignIn.click();
    await expect(marketing.signInHeading).toBeVisible();
    await marketing.callToActionJoin.click();
    await expect(marketing.joinHeading).toBeVisible();
  });

  test('a valid form creates the account and asks the visitor to check their inbox', async ({
    page,
    api,
    axe,
  }) => {
    const marketing = new MarketingPage(page);
    await marketing.open('?join');

    await marketing.join('Leah Thompson', 'leah@example.org', 'a-long-enough-passphrase');

    await expect(marketing.checkInbox).toBeVisible();
    await expect(marketing.sentTo('leah@example.org')).toBeVisible();
    await expect(marketing.sendAgain).toHaveAttribute(
      'href',
      'http://localhost:4200/verify-email?email=leah%40example.org',
    );
    expect(api.callsTo('POST', '/api/account/sign-up')[0].body).toEqual({
      name: 'Leah Thompson',
      email: 'leah@example.org',
      password: 'a-long-enough-passphrase',
    });
    await axe.check();
  });

  test('an email already registered gets the same check-your-inbox outcome', async ({
    page,
    api,
  }) => {
    api.addAccount({ email: 'grace@example.org' });
    const marketing = new MarketingPage(page);
    await marketing.open('?join');

    await marketing.join('Grace Okonkwo', 'grace@example.org', 'a-long-enough-passphrase');

    await expect(marketing.checkInbox).toBeVisible();
    await expect(marketing.sentTo('grace@example.org')).toBeVisible();
  });

  test('a short password is caught before anything is sent', async ({ page, api, axe }) => {
    const marketing = new MarketingPage(page);
    await marketing.open('?join');

    await marketing.join('Leah Thompson', 'leah@example.org', 'too-short');

    await expect(marketing.alert).toContainText('Fix 1 thing to create your account');
    await expect(marketing.passwordError).toHaveText(
      'Use at least 12 characters. A short phrase is easiest to remember.',
    );
    await expect(marketing.password).toBeFocused();
    expect(api.callsTo('POST', '/api/account/sign-up')).toHaveLength(0);
    await axe.check();
  });

  test('a breached password reported by the server shows on the password field', async ({
    page,
    api,
  }) => {
    api.on('POST', '/api/account/sign-up', (route) =>
      route.fulfill({
        status: 400,
        json: {
          status: 400,
          errors: {
            Password: ['This password has appeared in a data breach. Choose a different one.'],
          },
        },
      }),
    );
    const marketing = new MarketingPage(page);
    await marketing.open('?join');

    await marketing.join('Leah Thompson', 'leah@example.org', 'correcthorsebatterystaple');

    await expect(marketing.passwordError).toHaveText(
      'This password has appeared in a data breach. Choose a different one.',
    );
    await expect(marketing.checkInbox).toHaveCount(0);
  });

  test('empty, malformed and too-long fields each get an error and focus the first', async ({
    page,
    api,
  }) => {
    const marketing = new MarketingPage(page);
    await marketing.open('?join');

    await marketing.join('a'.repeat(101), 'not-an-email', '');

    await expect(marketing.alert).toContainText('Fix 3 things to create your account');
    await expect(marketing.nameError).toHaveText('Use 100 characters or fewer for your name.');
    await expect(marketing.emailError).toHaveText('Enter an email address like name@example.com.');
    await expect(marketing.passwordError).toHaveText('Enter a password.');
    await expect(marketing.name).toBeFocused();
    expect(api.callsTo('POST', '/api/account/sign-up')).toHaveLength(0);
  });

  test('a server failure keeps the details and says nothing was saved', async ({ page, api }) => {
    api.on('POST', '/api/account/sign-up', (route) =>
      route.fulfill({ status: 503, json: { status: 503 } }),
    );
    const marketing = new MarketingPage(page);
    await marketing.open('?join');

    await marketing.join('Leah Thompson', 'leah@example.org', 'a-long-enough-passphrase');

    await expect(marketing.alert).toContainText('We couldn’t create your account');
    await expect(marketing.email).toHaveValue('leah@example.org');
  });

  test('the submit button is busy while the account is being created', async ({ page, api }) => {
    let release: () => void = () => undefined;
    api.on(
      'POST',
      '/api/account/sign-up',
      (route) =>
        new Promise<void>((resolve) => {
          release = () => void route.fulfill({ status: 202 }).then(resolve);
        }),
    );
    const marketing = new MarketingPage(page);
    await marketing.open('?join');

    await marketing.join('Leah Thompson', 'leah@example.org', 'a-long-enough-passphrase');

    await expect(marketing.createAccount).toHaveAttribute('aria-busy', 'true');
    await expect(marketing.createAccount).toHaveText('Creating account…');
    release();
    await expect(marketing.checkInbox).toBeVisible();
  });
});
