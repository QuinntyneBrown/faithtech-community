import { expect, test } from '../../../e2e/fixtures/app';
import { AppShell } from '../../../e2e/pages/app-shell.page';
import { ErrorPages } from '../../../e2e/pages/error-pages.page';
import { seedHomeMock } from '../home-mock-data';
import { Presenter } from '../presenter';

test.use({ timezoneId: 'America/Toronto' });

// Journey: error and system pages (docs/detailed-designs/platform/error-and-system-pages, L2-048).
// The server error and the lost connection are staged on purpose.
test('error-and-system-pages', async ({ page, context, api }) => {
  const show = await Presenter.start(page, 'error-and-system-pages');
  const errors = new ErrorPages(page);
  const shell = new AppShell(page);
  const grace = await seedHomeMock(api);

  await show.card(
    'opening',
    'opening',
    [
      'Not found, no access, server errors and going offline',
      'Recorded against a local fake API · staged failures',
    ],
    () => api.signInAs(grace, '/no/such/page'),
  );

  await show.step('not-found', async () => {
    await expect(errors.notFound).toBeVisible();
    await expect(errors.goHome).toBeVisible();
  });

  await show.step('forbidden', async () => {
    await page.goto('/forbidden');
    await expect(errors.forbidden).toBeVisible();
  });

  await show.step(
    'server-error',
    async () => {
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
      await page.goto('/');
      await expect(errors.serverError).toBeVisible();
      await expect(errors.reference('7f3c-21a9-4b0e')).toBeVisible();
    },
    { poster: true },
  );

  await show.step('offline', async () => {
    api.on('GET', '/api/events', (route) => api.fallback(route));
    await page.goto('/');
    await expect(shell.topSearch).toBeVisible();
    await context.setOffline(true);
    await expect(errors.offlineBanner).toBeVisible();
    await shell.searchFromTopBar('Builders');
    await expect(errors.offline).toBeVisible();
  });

  await show.step('back-online', async () => {
    await context.setOffline(false);
    await expect(errors.offlineBanner).toHaveCount(0);
    await errors.tryAgain.click();
    await expect(page).toHaveURL('/search?q=Builders');
    await expect(errors.offline).toHaveCount(0);
  });

  await show.card('closing', 'closing', [
    'Friendly pages with a way forward',
    'A reference code for support',
    'An offline banner and page that clear themselves',
  ]);
  await show.finish();
});
