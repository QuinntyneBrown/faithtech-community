// Traces to: L2-150 AC1, AC3; L2-131 AC3 (docs/detailed-designs/organisations/platform-operations)
import { expect, test } from '../../fixtures/app';
import { EventsPage } from '../../pages/events.page';
import { SignInPage } from '../../pages/sign-in.page';
import { SystemPages } from '../../pages/system-pages.page';

test.describe('Suspending and lifting an organisation', () => {
  test('a signed-in member meets the neutral page once the organisation is suspended, and signs in again after the lift', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({
      email: 'grace@example.org',
      name: 'Grace Okonkwo',
      roles: ['Volunteer'],
    });
    await api.signInAs(grace, '/events');
    const events = new EventsPage(page);
    await expect(events.heading).toBeVisible();

    await api.suspendOrganisation();
    const pages = new SystemPages(page);
    const status = await pages.open('/events');

    expect(status).toBe(503);
    await expect(pages.suspended).toBeVisible();
    await expect(pages.controls).toHaveCount(0);
    await axe.check();

    await api.liftSuspension();
    await page.goto('/events');

    await expect(new SignInPage(page).heading).toBeVisible();
    await api.signInAs(grace, '/events');
    await expect(events.heading).toBeVisible();
    await axe.check();
  });
});
