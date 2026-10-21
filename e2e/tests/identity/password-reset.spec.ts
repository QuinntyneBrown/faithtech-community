import { expect, test } from '../../fixtures/app';
import { ForgotPasswordPage, ResetPasswordPage } from '../../pages/password-reset.page';

// L2-004: password reset (docs/detailed-designs/identity/password-reset).
test.describe('Forgot password', () => {
  test('any email gets the same neutral confirmation', async ({ page, api, axe }) => {
    const forgot = new ForgotPasswordPage(page);
    await forgot.open();
    await expect(forgot.heading).toBeVisible();
    await axe.check();

    await forgot.request('grace@example.org');

    await expect(forgot.checkEmail).toBeVisible();
    await expect(forgot.confirmationFor('grace@example.org')).toBeVisible();
    expect(api.callsTo('POST', '/api/account/forgot-password')[0].body).toEqual({
      email: 'grace@example.org',
    });
    await axe.check();
  });

  test('a malformed email is caught before anything is sent', async ({ page, api }) => {
    const forgot = new ForgotPasswordPage(page);
    await forgot.open();

    await forgot.request('grace');

    await expect(forgot.summary).toContainText('Check your email address');
    await expect(forgot.emailError).toHaveText('Enter an email like name@example.org.');
    await expect(forgot.email).toBeFocused();
    expect(api.callsTo('POST', '/api/account/forgot-password')).toHaveLength(0);
  });

  test('a server failure says the link was not sent', async ({ page, api }) => {
    api.on('POST', '/api/account/forgot-password', (route) =>
      route.fulfill({ status: 503, json: { status: 503 } }),
    );
    const forgot = new ForgotPasswordPage(page);
    await forgot.open();

    await forgot.request('grace@example.org');

    await expect(forgot.summary).toContainText('We couldn’t send the link');
  });
});

test.describe('Reset password', () => {
  test('a valid link sets the new password and says other devices were signed out', async ({
    page,
    api,
    axe,
  }) => {
    const reset = new ResetPasswordPage(page);
    await reset.openLink('user-1', 'token-1');
    await expect(reset.heading).toBeVisible();
    await axe.check();

    await reset.save('a-brand-new-passphrase');

    await expect(reset.updated).toBeVisible();
    expect(api.callsTo('POST', '/api/account/reset-password')[0].body).toEqual({
      userId: 'user-1',
      token: 'token-1',
      password: 'a-brand-new-passphrase',
    });
    await axe.check();
  });

  test('a short or mismatched password gets an error on each field', async ({ page, api }) => {
    const reset = new ResetPasswordPage(page);
    await reset.openLink('user-1', 'token-1');

    await reset.save('too-short', 'different');

    await expect(reset.summary).toContainText('Fix 2 things to save your password');
    await expect(reset.passwordError).toHaveText('Use at least 12 characters.');
    await expect(reset.confirmError).toHaveText('This doesn’t match the password above.');
    await expect(reset.password).toBeFocused();
    expect(api.callsTo('POST', '/api/account/reset-password')).toHaveLength(0);
  });

  test('an expired or used link offers a new one', async ({ page, api, axe }) => {
    api.on('POST', '/api/account/reset-password', (route) =>
      route.fulfill({
        status: 400,
        json: {
          status: 400,
          errors: { Token: ['This link has expired or has already been used.'] },
        },
      }),
    );
    const reset = new ResetPasswordPage(page);
    await reset.openLink('user-1', 'old-token');

    await reset.save('a-brand-new-passphrase');

    await expect(reset.expired).toBeVisible();
    await expect(reset.sendNewLink).toHaveAttribute('href', '/forgot-password');
    await axe.check();
  });

  test('a breached password reported by the server shows on the field', async ({ page, api }) => {
    api.on('POST', '/api/account/reset-password', (route) =>
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
    const reset = new ResetPasswordPage(page);
    await reset.openLink('user-1', 'token-1');

    await reset.save('correcthorsebatterystaple');

    await expect(reset.passwordError).toHaveText(
      'This password has appeared in a data breach. Choose a different one.',
    );
  });
});
