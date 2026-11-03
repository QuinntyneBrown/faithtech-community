import { expect, test } from '../../fixtures/app';
import { AppShell } from '../../pages/app-shell.page';
import { ErrorPages } from '../../pages/error-pages.page';
import { SignInPage } from '../../pages/sign-in.page';

// L2-048: error and system pages (docs/detailed-designs/platform/error-and-system-pages).
test.describe('Error and system pages', () => {
  test('an unknown route shows the not-found page with a link home, in the public shell when signed out', async ({
    page,
    axe,
  }) => {
    const errors = new ErrorPages(page);

    await page.goto('/no/such/page');

    await expect(errors.notFound).toBeVisible();
    await expect(errors.goHome).toHaveAttribute('href', '/');
    await expect(errors.search).toHaveCount(0);
    await expect(errors.topBarSignIn).toBeVisible();
    await axe.check();
  });

  test('a signed-in member sees the not-found page inside the app shell', async ({
    page,
    api,
    axe,
  }) => {
    const errors = new ErrorPages(page);
    const shell = new AppShell(page);

    await api.signInAs(
      api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] }),
      '/no/such/page',
    );

    await expect(errors.notFound).toBeVisible();
    await expect(shell.navLink('Home')).toBeVisible();
    await expect(errors.goHome).toHaveAttribute('href', '/');
    await axe.check();
  });

  test('the forbidden page explains missing access without naming the resource', async ({
    page,
    api,
    axe,
  }) => {
    const errors = new ErrorPages(page);
    const shell = new AppShell(page);

    await api.signInAs(
      api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] }),
      '/forbidden',
    );

    await expect(errors.forbidden).toBeVisible();
    await expect(errors.goHome).toBeVisible();
    await expect(shell.navLink('Home')).toBeVisible();
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

  test('a server error during a member’s visit keeps the app shell around the reference', async ({
    page,
    api,
  }) => {
    const errors = new ErrorPages(page);
    const shell = new AppShell(page);
    // Home's events fail with a 500
    api.on('GET', '/api/events', (route) =>
      route.fulfill({
        status: 500,
        headers: {
          'X-Correlation-ID': '7f3c-21a9-4b0e',
          'Access-Control-Expose-Headers': 'X-Correlation-ID',
        },
        json: { status: 500 },
      }),
    );

    await api.signInAs(api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] }));

    await expect(errors.serverError).toBeVisible();
    await expect(errors.reference('7f3c-21a9-4b0e')).toBeVisible();
    await expect(shell.navLink('Home')).toBeVisible();
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

  test('a page that cannot load offline shows the offline page, and Try again opens it once back online', async ({
    page,
    context,
    api,
    axe,
  }) => {
    // Given a signed-in member on home whose connection drops
    const errors = new ErrorPages(page);
    const shell = new AppShell(page);
    await api.signInAs(api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] }));
    await expect(shell.topSearch).toBeVisible();
    await context.setOffline(true);

    // When they search from the top bar, whose results page the app has not loaded yet
    await shell.searchFromTopBar('Grace');

    // Then the offline page offers to try again, under the banner, which sits below the top bar
    await expect(errors.offline).toBeVisible();
    await expect(errors.offlineBanner).toBeVisible();
    const { bar, banner } = await errors.barAndBanner();
    expect(banner.y).toBeGreaterThanOrEqual(bar.y + bar.height);
    await axe.check();

    // And once back online, Try again opens the section
    await context.setOffline(false);
    await errors.tryAgain.click();
    await expect(page).toHaveURL('/search?q=Grace');
    await expect(errors.offline).toHaveCount(0);
  });
});
