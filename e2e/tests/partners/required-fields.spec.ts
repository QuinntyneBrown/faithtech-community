// Traces to: L2-017, L2-044 (docs/design-system/components/form-field.html: required fields are
// conveyed as required, optional fields are marked "(optional)").
import { expect, test } from '../../fixtures/app';
import { requiredStates } from '../../pages/accessibility-tree';
import { AddPartnerDialog } from '../../pages/add-partner.dialog';
import { PartnerFormPage } from '../../pages/partner-form.page';
import { PartnersPage } from '../../pages/partners.page';

test.describe('Partners required fields', () => {
  test('the add-partner dialog and the partner form announce what is required', async ({
    page,
    api,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const kestrel = api.partners.add({ name: 'Kestrel Labs' });
    const partners = new PartnersPage(page);
    await api.signInAs(grace, '/partners');
    await partners.addPartner.click();
    const dialog = new AddPartnerDialog(page);
    await dialog.opened();
    expect(await requiredStates(page)).toMatchObject({
      Organisation: true,
      'Website (optional)': false,
      'Email (optional)': false,
      'Owner (optional)': false,
    });
    await page.keyboard.press('Escape');
    await expect(dialog.dialog).toBeHidden();

    const form = new PartnerFormPage(page);
    await page.goto(`/partners/${kestrel.id}/edit`);
    await expect(form.name).toBeVisible();
    expect(await requiredStates(page)).toMatchObject({
      Organisation: true,
      'Website (optional)': false,
      'Email (optional)': false,
      'Owner (optional)': false,
    });
  });
});
