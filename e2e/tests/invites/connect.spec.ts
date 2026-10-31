// Traces to: L2-082, L2-083, L2-084 (docs/detailed-designs/invites/connect-by-qr-code)
import { expect, test } from '../../fixtures/app';
import { photoUrl } from '../../fixtures/mock-api';
import { ConnectPage } from '../../pages/connect.page';
import { ContactsPage } from '../../pages/contacts.page';
import { VerifyEmailPage } from '../../pages/verify-email.page';

test.describe('Connect page', () => {
  test('a visitor sees who they are connecting with and what connecting does', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const profile = api.profiles.get(grace.profileId)!;
    profile.chapterId = api.chapters.named('Toronto').id;
    profile.photos = [
      {
        id: 'p1',
        url: photoUrl('#4a90d9', 'grace'),
        altText: 'Grace at Builders Night',
        isFeatured: true,
        uploadedAt: '2026-10-01T12:00:00Z',
      },
    ];
    const link = api.connect.addLink(grace.profileId);
    const connect = new ConnectPage(page);

    await connect.open(link.token);

    await expect(connect.heading).toHaveText('Connect with Grace');
    await expect(connect.leadName).toHaveText('Grace Okonkwo');
    await expect(connect.leadMeta).toHaveText('City Lead · Toronto');
    await expect(connect.consent).toBeVisible();
    await expect(connect.signInToConnect).toHaveAttribute(
      'href',
      `/sign-in?returnUrl=${encodeURIComponent(`/meet/${link.token}`)}`,
    );
    // The token travels in the body of the lookup, never an API URL (L2-043).
    expect(api.callsTo('POST', '/api/connect/lookup')[0].body).toEqual({ token: link.token });
    await axe.check();
  });

  test('signing up asks the person to check their email; verifying makes them the lead’s contact', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const link = api.connect.addLink(grace.profileId);
    const connect = new ConnectPage(page);
    await connect.open(link.token);

    await connect.signUp('Tomás Ortega', 'tomas.ortega@example.org', 'a-long-enough-passphrase');

    await expect(connect.heading).toHaveText('Check your email');
    await expect(connect.sentTo('tomas.ortega@example.org')).toBeVisible();
    expect(api.callsTo('POST', '/api/connect/sign-up')[0].body).toEqual({
      token: link.token,
      name: 'Tomás Ortega',
      email: 'tomas.ortega@example.org',
      password: 'a-long-enough-passphrase',
    });
    expect(api.contacts.contacts).toHaveLength(0);
    await axe.check();

    const tomas = api.accounts.get('tomas.ortega@example.org')!;
    await new VerifyEmailPage(page).openLink(`user-${tomas.profileId}`, 'verify-token');
    await expect(page.getByRole('heading', { level: 1, name: /You’re in/ })).toBeVisible();

    const contacts = new ContactsPage(page);
    await api.signInAs(grace, '/contacts');
    await expect(contacts.item('Tomás Ortega')).toBeVisible();
    expect(api.contacts.contacts[0]).toMatchObject({
      ownerId: grace.profileId,
      email: 'tomas.ortega@example.org',
      linkedProfileId: tomas.profileId,
    });
    expect(tomas.roles).toEqual([]);
  });

  test('an email that already has an account gets the same check-your-email answer', async ({
    page,
    api,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    api.addAccount({ email: 'jonah@example.org', name: 'Jonah Bell' });
    const link = api.connect.addLink(grace.profileId);
    const connect = new ConnectPage(page);
    await connect.open(link.token);

    await connect.signUp('Jonah Bell', 'jonah@example.org', 'a-long-enough-passphrase');

    await expect(connect.heading).toHaveText('Check your email');
    expect(api.connect.pending.size).toBe(0);
  });

  test('the sign-up rules match normal sign-up', async ({ page, api, axe }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const link = api.connect.addLink(grace.profileId);
    const connect = new ConnectPage(page);
    await connect.open(link.token);

    await connect.signUp('a'.repeat(101), 'tomas@example.org', 'too-short');

    await expect(connect.summary).toContainText('Fix 2 things to create your account');
    await expect(connect.nameError).toHaveText('Use 100 characters or fewer for your name.');
    await expect(connect.passwordError).toHaveText(
      'Use at least 12 characters. A short phrase is easiest to remember.',
    );
    await expect(connect.name).toBeFocused();
    expect(api.callsTo('POST', '/api/connect/sign-up')).toHaveLength(0);
    await axe.check();
  });

  test('a replaced or unknown code says it no longer works and offers normal sign-up', async ({
    page,
    api,
    axe,
  }) => {
    const connect = new ConnectPage(page);

    await connect.open('retired-token');

    await expect(connect.heading).toHaveText('This code no longer works');
    await expect(connect.createAccount).toHaveAttribute('href', '/sign-up');
    await axe.check();
  });

  test('a lookup that cannot reach FaithTech offers Try again', async ({ page, api, axe }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const link = api.connect.addLink(grace.profileId);
    let fail = true;
    api.on('POST', '/api/connect/lookup', (route) => {
      if (!fail) return api.fallback(route);
      fail = false;
      return route.abort('failed');
    });
    const connect = new ConnectPage(page);
    await connect.open(link.token);
    await expect(connect.heading).toHaveText('We couldn’t load this page');
    await axe.check();

    await connect.tryAgain.click();

    await expect(connect.heading).toHaveText('Connect with Grace');
  });
});

test.describe('Connect page, signed in', () => {
  test('a signed-in member who opens the link is connected at once', async ({ page, api, axe }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const jonah = api.addAccount({ email: 'jonah@example.org', name: 'Jonah Bell' });
    const link = api.connect.addLink(grace.profileId);
    const connect = new ConnectPage(page);
    await api.signInAs(jonah, '/');

    await connect.open(link.token);

    await expect(connect.heading).toHaveText('You’re connected');
    await expect(connect.connected).toContainText('Connected with Grace Okonkwo');
    expect(api.contacts.contacts).toEqual([
      expect.objectContaining({ ownerId: grace.profileId, linkedProfileId: jonah.profileId }),
    ]);
    expect(api.callsTo('POST', '/api/connect')[0].body).toEqual({ token: link.token });
    await axe.check();
  });

  test('Sign in to connect comes back to the page and connects', async ({ page, api }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const jonah = api.addAccount({ email: 'jonah@example.org', name: 'Jonah Bell' });
    const link = api.connect.addLink(grace.profileId);
    const connect = new ConnectPage(page);
    await connect.open(link.token);

    await connect.signInToConnect.click();
    await page.getByLabel('Email').fill(jonah.email);
    await page.getByLabel('Password', { exact: true }).fill(jonah.password);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(connect.heading).toHaveText('You’re connected');
    expect(api.contacts.contacts).toHaveLength(1);
  });

  test('a member whose email is not verified is told to verify to finish', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const leah = api.addAccount({
      email: 'leah@example.org',
      name: 'Leah Thompson',
      verified: false,
    });
    const link = api.connect.addLink(grace.profileId);
    const connect = new ConnectPage(page);
    await api.signInAs(leah, '/');

    await connect.open(link.token);

    await expect(connect.heading).toHaveText('Almost connected');
    await expect(connect.pending).toBeVisible();
    expect(api.contacts.contacts).toHaveLength(0);
    await axe.check();
  });

  test('a lead who opens their own code is told it works and nothing changes', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const link = api.connect.addLink(grace.profileId);
    const connect = new ConnectPage(page);
    await api.signInAs(grace, '/');

    await connect.open(link.token);

    await expect(connect.heading).toHaveText('Your QR code works');
    await expect(connect.ownCode).toBeVisible();
    expect(api.contacts.contacts).toHaveLength(0);
    await axe.check();
  });
});
