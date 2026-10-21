import { expect, test } from '../../../e2e/fixtures/app';
import { VerifyEmailPage } from '../../../e2e/pages/verify-email.page';
import { Presenter, typeInto } from '../presenter';

// Journey: verify email (docs/detailed-designs/identity/email-verification, L2-002).
// The link in the email is opened the way the email's link opens it; ids and tokens are fake.
test('verify-email', async ({ page, api }) => {
  const show = await Presenter.start(page, 'verify-email');
  const verify = new VerifyEmailPage(page);

  await show.card(
    'opening',
    'opening',
    ['Confirm your email address', 'Recorded against a local fake API · synthetic data'],
    () => verify.openPending('leah@example.org'),
  );

  await show.step('pending', async () => {
    await expect(verify.pending).toBeVisible();
    await expect(verify.sentTo('leah@example.org')).toBeVisible();
  });

  await show.step('resend', async () => {
    await verify.sendNewLink.click();
    await expect(verify.message).toContainText('We sent a new link to leah@example.org');
  });

  await show.step(
    'open-link',
    async () => {
      await verify.openLink('demo-user', 'demo-token');
      await expect(verify.verified).toBeVisible();
      await expect(verify.setUpProfile).toBeVisible();
    },
    { poster: true },
  );

  await show.step('expired-link', async () => {
    api.on('POST', '/api/account/verify-email', (route) =>
      route.fulfill({
        status: 400,
        json: {
          status: 400,
          errors: { Token: ['This link has expired or has already been used.'] },
        },
      }),
    );
    await verify.openLink('demo-user', 'used-token');
    await expect(verify.expired).toBeVisible();
  });

  await show.step('new-link', async () => {
    await typeInto(verify.email, 'leah@example.org');
    await verify.sendNewLink.click();
    await expect(verify.message).toContainText('We sent a new link to leah@example.org');
  });

  await show.card('closing', 'closing', [
    'The page names the address the link went to',
    'Send a new link any time',
    'Expired links say so and offer a new one',
  ]);
  await show.finish();
});
