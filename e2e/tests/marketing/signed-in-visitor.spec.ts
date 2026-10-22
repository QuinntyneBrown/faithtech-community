import { expect, test } from '../../fixtures/app';
import { AppShell } from '../../pages/app-shell.page';
import { MarketingPage } from '../../pages/marketing.page';

// Traces to: L2-055 AC6 (docs/detailed-designs/marketing/landing-page, ADR 0017).
test.describe('A member who is already signed in', () => {
  test('with a session kept on this device goes straight to the community app', async ({
    page,
    api,
  }) => {
    const account = api.addAccount({ email: 'grace@example.org' });
    const marketing = new MarketingPage(page);
    await marketing.open();
    await marketing.signIn(account.email, account.password, { keepSignedIn: true });
    await expect(page).toHaveURL('http://localhost:4200/');

    await marketing.open();

    await expect(page).toHaveURL('http://localhost:4200/');
    await expect(new AppShell(page).primaryNav).toBeVisible();
  });

  test('without a kept session sees the marketing page', async ({ page, api }) => {
    const account = api.addAccount({ email: 'grace@example.org' });
    const marketing = new MarketingPage(page);
    await marketing.open();
    await marketing.signIn(account.email, account.password);
    await expect(page).toHaveURL('http://localhost:4200/');

    await marketing.open();

    await expect(marketing.heading).toBeVisible();
  });

  test('after signing out sees the marketing page again', async ({ page, api }) => {
    const account = api.addAccount({ email: 'grace@example.org', name: 'Grace Okonkwo' });
    const marketing = new MarketingPage(page);
    await marketing.open();
    await marketing.signIn(account.email, account.password, { keepSignedIn: true });
    await expect(page).toHaveURL('http://localhost:4200/');

    await new AppShell(page).signOut('Grace Okonkwo');
    await marketing.open();

    await expect(marketing.heading).toBeVisible();
  });
});
