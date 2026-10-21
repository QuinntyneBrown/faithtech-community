import { expect, test } from '../../fixtures/app';
import { ErrorPages } from '../../pages/error-pages.page';
import { SignInPage } from '../../pages/sign-in.page';

// L2-048: error and system pages (docs/detailed-designs/platform/error-and-system-pages).
test.describe('Error and system pages', () => {
  test('an unknown route shows the not-found page with links home and to search', async ({
    page,
    axe,
  }) => {
    const errors = new ErrorPages(page);

    await page.goto('/no/such/page');

    await expect(errors.notFound).toBeVisible();
    await expect(errors.goHome).toHaveAttribute('href', '/');
    await expect(errors.search).toHaveAttribute('href', '/search');
    await axe.check();
  });

  test('the forbidden page explains missing access without naming the resource', async ({
    page,
    axe,
  }) => {
    const errors = new ErrorPages(page);

    await page.goto('/forbidden');

    await expect(errors.forbidden).toBeVisible();
    await expect(errors.goHome).toBeVisible();
    await axe.check();
  });

  test('a server error shows a reference that matches the correlation id', async ({
    page,
    api,
    axe,
  }) => {
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
    const signIn = new SignInPage(page);
    const errors = new ErrorPages(page);
    await signIn.open();

    await signIn.signIn('grace@example.org', 'a-long-enough-passphrase');

    await expect(errors.serverError).toBeVisible();
    await expect(errors.reference('c0ffee-42')).toBeVisible();
    await axe.check();
  });

  test('an offline banner appears while the connection is down and clears when it returns', async ({
    page,
    context,
    axe,
  }) => {
    const errors = new ErrorPages(page);
    await new SignInPage(page).open();

    await context.setOffline(true);
    await expect(errors.offlineBanner).toBeVisible();
    await axe.check();

    await context.setOffline(false);
    await expect(errors.offlineBanner).toHaveCount(0);
  });
});
