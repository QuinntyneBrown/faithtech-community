import { expect, test } from '../../fixtures/app';
import { MockApi } from '../../fixtures/mock-api';
import { NORTHSIDE } from '../../fixtures/mock-host';
import { AppShell } from '../../pages/app-shell.page';
import { DocumentText } from '../../pages/document.page';
import { PublicEventPage } from '../../pages/public-event.page';
import { SignInPage } from '../../pages/sign-in.page';
import { SignUpPage } from '../../pages/sign-up.page';

// Traces to: L2-134 AC1, AC2, L2-133 AC1 (docs/detailed-designs/organisations/tenancy-and-host-resolution).
// Copy that names the product reads the host's organisation: from /api/site before sign-in, from /api/me after.

function addPublicEvent(api: MockApi) {
  return api.events.add({
    title: 'Toronto Builders Night',
    description: 'An evening for Christians who build.',
    startsAt: '2026-11-06T23:30:00.000Z',
    endsAt: '2026-11-07T02:00:00.000Z',
    visibility: 'Public',
  });
}

test.describe('The organisation’s name in the app', () => {
  test('a FaithTech member sees FaithTech in the top bar and the page title', async ({
    page,
    api,
    axe,
  }) => {
    const shell = new AppShell(page);
    await api.signInAs(
      api.addAccount({ email: 'grace@example.org', roles: ['Volunteer'] }),
      '/events',
    );

    await expect(shell.brand).toHaveText('FaithTech');
    await expect(page).toHaveTitle('Events · FaithTech');
    await axe.check();
  });

  test('a member of another organisation sees its name and never FaithTech', async ({
    page,
    api,
    axe,
  }) => {
    api.host.serve(NORTHSIDE);
    const shell = new AppShell(page);
    await api.signInAs(
      api.addAccount({ email: 'ana@example.org', roles: ['Volunteer'] }),
      '/events',
    );

    await expect(shell.brand).toHaveText('Northside');
    await expect(page).toHaveTitle('Events · Northside');
    await expect(new DocumentText(page).body).not.toContainText('FaithTech');
    await axe.check();
  });

  test('before sign-in, sign in and sign up name the host’s organisation', async ({
    page,
    api,
    axe,
  }) => {
    api.host.serve(NORTHSIDE);
    const signIn = new SignInPage(page);
    const signUp = new SignUpPage(page);

    await signIn.open();
    await expect(signIn.newHere('Northside')).toBeVisible();
    await expect(page).toHaveTitle(/Northside$/);
    await axe.check();

    await signUp.open();
    await expect(signUp.headingFor('Northside')).toBeVisible();
    await expect(new DocumentText(page).body).not.toContainText('FaithTech');
    await axe.check();
  });

  test('a public event names the organisation that hosts it', async ({ page, api, axe }) => {
    api.host.serve(NORTHSIDE);
    const publicPage = new PublicEventPage(page);
    const event = addPublicEvent(api);

    await publicPage.open(event.id);

    await expect(publicPage.overline).toHaveText('Northside Toronto · Public event');
    await expect(publicPage.hostedBy).toContainText('Northside Toronto');
    await expect(new DocumentText(page).body).not.toContainText('FaithTech');
    await axe.check();
  });
});
