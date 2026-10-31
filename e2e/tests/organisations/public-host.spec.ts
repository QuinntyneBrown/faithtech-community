import { expect, test } from '../../fixtures/app';
import { NORTHSIDE } from '../../fixtures/mock-host';
import { DocumentText } from '../../pages/document.page';
import { MarketingPage } from '../../pages/marketing.page';

// Traces to: L2-134 AC3 (docs/detailed-designs/organisations/tenancy-and-host-resolution).
// One marketing build serves every public host: its headline, name, brochure and footer come from GET /api/site,
// which answers that host's Marketing:Sites entry.
test.describe('An organisation’s public host', () => {
  test('shows that organisation’s headline, name and footer, and never FaithTech', async ({
    page,
    api,
    axe,
  }) => {
    api.host.serve(NORTHSIDE);
    const marketing = new MarketingPage(page);

    await marketing.open();

    await expect(marketing.headline).toHaveText('Make things with your neighbours');
    await expect(marketing.eyebrowNamed('Northside Makers')).toBeVisible();
    await expect(marketing.footer).toContainText('© 2026 Northside Makers');
    await expect(marketing.video).toHaveCount(0);
    await expect(new DocumentText(page).body).not.toContainText('FaithTech');
    await axe.check();
  });

  test('FaithTech’s public host reads as before, from its own entry', async ({ page, axe }) => {
    const marketing = new MarketingPage(page);

    await marketing.open();

    await expect(marketing.heading).toBeVisible();
    await expect(marketing.eyebrow).toBeVisible();
    await expect(marketing.footer).toContainText('© 2026 FaithTech');
    await expect(marketing.video).toHaveAccessibleName('FaithTech Community in 21 seconds');
    await axe.check();
  });
});
