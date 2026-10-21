import { expect, test } from '../../../e2e/fixtures/app';
import { ErrorPages } from '../../../e2e/pages/error-pages.page';
import { SignInPage } from '../../../e2e/pages/sign-in.page';
import { Presenter, typeInto } from '../presenter';

// Journey: error and system pages (docs/detailed-designs/platform/error-and-system-pages, L2-048).
// The server error and the lost connection are staged on purpose.
test('error-and-system-pages', async ({ page, context, api }) => {
  const show = await Presenter.start(page, 'error-and-system-pages');
  const errors = new ErrorPages(page);
  const signIn = new SignInPage(page);

  await show.card(
    'opening',
    'opening',
    [
      'Not found, no access, server errors and going offline',
      'Recorded against a local fake API · staged failures',
    ],
    () => page.goto('/no/such/page').then(() => undefined),
  );

  await show.step('not-found', async () => {
    await expect(errors.notFound).toBeVisible();
    await expect(errors.goHome).toBeVisible();
    await expect(errors.search).toBeVisible();
  });

  await show.step('forbidden', async () => {
    await page.goto('/forbidden');
    await expect(errors.forbidden).toBeVisible();
  });

  await show.step(
    'server-error',
    async () => {
      api.on('POST', '/api/account/sign-in', (route) =>
        route.fulfill({
          status: 500,
          headers: {
            'X-Correlation-ID': 'c0ffee-42',
            'Access-Control-Expose-Headers': 'X-Correlation-ID',
          },
          json: { status: 500, traceId: 'c0ffee-42' },
        }),
      );
      await signIn.open();
      await typeInto(signIn.email, 'grace@example.org');
      await typeInto(signIn.password, 'a-long-enough-passphrase');
      await signIn.submit.click();
      await expect(errors.serverError).toBeVisible();
      await expect(errors.reference('c0ffee-42')).toBeVisible();
    },
    { poster: true },
  );

  await show.step('offline', async () => {
    await signIn.open();
    await expect(signIn.heading).toBeVisible();
    await context.setOffline(true);
    await expect(errors.offlineBanner).toBeVisible();
  });

  await show.step('back-online', async () => {
    await context.setOffline(false);
    await expect(errors.offlineBanner).toHaveCount(0);
  });

  await show.card('closing', 'closing', [
    'Friendly pages with a way forward',
    'A reference code for support',
    'An offline banner that clears itself',
  ]);
  await show.finish();
});
