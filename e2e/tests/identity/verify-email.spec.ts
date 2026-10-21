import { expect, test } from '../../fixtures/app';
import { AppShell } from '../../pages/app-shell.page';
import { VerifyEmailPage } from '../../pages/verify-email.page';

// L2-002: email verification (docs/detailed-designs/identity/email-verification).
test.describe('Verify email', () => {
  test('a valid link verifies the email and offers to set up the profile', async ({
    page,
    api,
    axe,
  }) => {
    const verify = new VerifyEmailPage(page);

    await verify.openLink('user-1', 'token-1');

    await expect(verify.verified).toBeVisible();
    await expect(verify.setUpProfile).toBeVisible();
    expect(api.callsTo('POST', '/api/account/verify-email')[0].body).toEqual({
      userId: 'user-1',
      token: 'token-1',
    });
    await axe.check();
  });

  test('an expired or used link offers to send a new one', async ({ page, api, axe }) => {
    api.on('POST', '/api/account/verify-email', (route) =>
      route.fulfill({
        status: 400,
        json: {
          status: 400,
          errors: { Token: ['This link has expired or has already been used.'] },
        },
      }),
    );
    const verify = new VerifyEmailPage(page);

    await verify.openLink('user-1', 'old-token');
    await expect(verify.expired).toBeVisible();
    await axe.check();

    await verify.email.fill('leah@example.org');
    await verify.sendNewLink.click();

    await expect(verify.message).toContainText('We sent a new link to leah@example.org');
    expect(api.callsTo('POST', '/api/account/resend-verification')[0].body).toEqual({
      email: 'leah@example.org',
    });
  });

  test('the pending page names the address and can send another link', async ({
    page,
    api,
    axe,
  }) => {
    const verify = new VerifyEmailPage(page);

    await verify.openPending('leah@example.org');
    await expect(verify.pending).toBeVisible();
    await expect(verify.sentTo('leah@example.org')).toBeVisible();
    await axe.check();

    await verify.sendNewLink.click();

    await expect(verify.message).toContainText('We sent a new link to leah@example.org');
    expect(api.callsTo('POST', '/api/account/resend-verification')).toHaveLength(1);
  });

  test('too many resends are refused with try again later', async ({ page, api }) => {
    api.on('POST', '/api/account/resend-verification', (route) =>
      route.fulfill({ status: 429, json: { status: 429 } }),
    );
    const verify = new VerifyEmailPage(page);

    await verify.openPending('leah@example.org');
    await verify.sendNewLink.click();

    await expect(verify.message).toContainText('try again later');
  });

  test('an unverified member sees a banner that can resend the link', async ({
    page,
    api,
    axe,
  }) => {
    const account = api.addAccount({ email: 'leah@example.org', verified: false });
    const shell = new AppShell(page);

    await api.signInAs(account);

    await expect(shell.verifyBanner).toContainText('We sent a link to leah@example.org');
    await axe.check();
    await shell.sendVerificationAgain.click();
    await expect(shell.verifyBanner).toContainText('We sent a new link');
    expect(api.callsTo('POST', '/api/account/resend-verification')[0].body).toEqual({
      email: 'leah@example.org',
    });
  });

  test('a verified member sees no banner', async ({ page, api }) => {
    const account = api.addAccount({ email: 'grace@example.org' });
    const shell = new AppShell(page);

    await api.signInAs(account);

    await expect(page).toHaveURL(/\/$/);
    await expect(shell.verifyBanner).toHaveCount(0);
  });
});
