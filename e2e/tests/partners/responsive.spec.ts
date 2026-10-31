// Traces to: L2-017, L2-018 AC4 with L2-045 AC1 (docs/detailed-designs/platform/responsive-layout-and-theming)
import { expect, test } from '../../fixtures/app';
import { PartnerPage } from '../../pages/partner.page';
import { PartnersPage } from '../../pages/partners.page';
import {
  BREAKPOINTS,
  BreakpointName,
  hasHorizontalScroll,
  undersizedTargets,
} from '../../pages/viewport';

for (const name of Object.keys(BREAKPOINTS) as BreakpointName[]) {
  test(`the partner screens fit and keep 24px targets at ${name}`, async ({ page, api }) => {
    await page.setViewportSize(BREAKPOINTS[name]);
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const kestrel = api.partners.add({
      name: 'Kestrel Labs',
      stage: 'in-funnel',
      contactName: 'Nadia Petrov',
      offering: 'Hosting Builders Night · contract review',
    });
    api.partners.add({ name: 'Maple Street Church', contactName: 'Kwame Asante' });

    await api.signInAs(grace, '/partners');
    const partners = new PartnersPage(page);
    await expect(partners.board).toBeVisible();
    await expect(partners.stageTabs).toHaveCount(name === 'xs' ? 1 : 0);
    expect(await hasHorizontalScroll(page), 'partners').toBe(false);
    expect(await undersizedTargets(page), 'partners').toEqual([]);

    const partner = new PartnerPage(page);
    await partner.open(kestrel.id);
    await expect(partner.heading).toHaveText('Kestrel Labs');
    expect(await hasHorizontalScroll(page), 'partner').toBe(false);
    expect(await undersizedTargets(page), 'partner').toEqual([]);

    await page.goto(`/partners/${kestrel.id}/edit`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Edit partner');
    expect(await hasHorizontalScroll(page), 'partner form').toBe(false);
    expect(await undersizedTargets(page), 'partner form').toEqual([]);
  });
}
