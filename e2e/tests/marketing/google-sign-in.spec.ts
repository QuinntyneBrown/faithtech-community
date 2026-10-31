import { expect, test } from '../../fixtures/app';
import { MarketingPage } from '../../pages/marketing.page';

// Traces to: L2-078, L2-079 AC4 (docs/detailed-designs/identity/google-sign-in).
test.describe('Sign in with Google from the marketing page', () => {
  test('a new Google account gets an account with no role and lands in the community app', async ({
    page,
    api,
    axe,
  }) => {
    api.google.account = { email: 'leah@gmail.com', name: 'Leah Thompson', emailVerified: true };
    const marketing = new MarketingPage(page);
    await marketing.open();
    await expect(marketing.signInWithGoogle).toBeVisible();
    await axe.check();

    await marketing.signInWithGoogle.click();

    await expect(page).toHaveURL('http://localhost:4200/');
    const account = api.accounts.get('leah@gmail.com');
    expect(account).toMatchObject({ name: 'Leah Thompson', verified: true, roles: [] });
    const exchange = api.callsTo('POST', '/connect/token')[0];
    expect(String(exchange.body['code_verifier'])).toMatch(/^[A-Za-z0-9_-]{43,}$/);
  });

  test('a Google account with a matching email signs into the existing account', async ({
    page,
    api,
  }) => {
    api.addAccount({ email: 'grace@example.org', name: 'Grace Okonkwo', roles: ['CityLead'] });
    api.google.account = { email: 'grace@example.org', name: 'Grace O.', emailVerified: true };
    const marketing = new MarketingPage(page);
    await marketing.open('?returnUrl=%2Fevents');

    await marketing.signInWithGoogle.click();

    await expect(page).toHaveURL('http://localhost:4200/events');
    expect(api.accounts.size).toBe(1);
  });

  test('Sign up with Google on the join form starts the same flow', async ({ page, api }) => {
    api.google.account = { email: 'leah@gmail.com', name: 'Leah Thompson', emailVerified: true };
    const marketing = new MarketingPage(page);
    await marketing.open('?join');

    await marketing.signUpWithGoogle.click();

    await expect(page).toHaveURL('http://localhost:4200/');
    expect(api.callsTo('GET', '/api/account/google/start')).toHaveLength(1);
  });

  test('a Google email that is not verified is refused', async ({ page, api, axe }) => {
    api.google.account = { email: 'leah@gmail.com', name: 'Leah Thompson', emailVerified: false };
    const marketing = new MarketingPage(page);
    await marketing.open();

    await marketing.signInWithGoogle.click();

    await expect(page).toHaveURL('http://localhost:4300/?google=failed');
    await expect(marketing.alert).toContainText('Google sign-in didn’t finish');
    expect(api.accounts.has('leah@gmail.com')).toBe(false);
    await axe.check();
  });

  test('a suspended account is refused with the same message as password sign-in', async ({
    page,
    api,
  }) => {
    api.addAccount({ email: 'grace@example.org', suspended: true });
    api.google.account = { email: 'grace@example.org', name: 'Grace', emailVerified: true };
    const marketing = new MarketingPage(page);
    await marketing.open();

    await marketing.signInWithGoogle.click();

    await expect(marketing.alert).toContainText(
      'Your membership of FaithTech Community is suspended',
    );
  });

  test('cancelling at Google returns to the page with the failure message', async ({
    page,
    api,
  }) => {
    api.google.account = null;
    const marketing = new MarketingPage(page);
    await marketing.open();

    await marketing.signInWithGoogle.click();

    await expect(marketing.alert).toContainText('Google sign-in didn’t finish');
    await expect(marketing.signInWithGoogle).toBeVisible();
  });

  test('the page only talks to its own origin, the community app and Google', async ({
    page,
    api,
  }) => {
    const hosts = new Set<string>();
    page.on('request', (request) => hosts.add(new URL(request.url()).host));
    api.google.account = { email: 'leah@gmail.com', name: 'Leah Thompson', emailVerified: true };
    const marketing = new MarketingPage(page);

    await marketing.open();
    await marketing.signInWithGoogle.click();
    await expect(page).toHaveURL('http://localhost:4200/');

    expect([...hosts].sort()).toEqual(['accounts.google.com', 'localhost:4200', 'localhost:4300']);
  });
});
