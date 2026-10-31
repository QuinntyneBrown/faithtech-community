// Traces to: L2-017 (docs/detailed-designs/partners/manage-partners)
import { expect, test } from '../../fixtures/app';
import { AddPartnerDialog } from '../../pages/add-partner.dialog';
import { PartnerFormPage } from '../../pages/partner-form.page';
import { PartnerPage } from '../../pages/partner.page';
import { PartnersPage } from '../../pages/partners.page';

test.describe('Manage partners', () => {
  test('a lead adds a partner and it appears at the chosen stage', async ({ page, api, axe }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const partners = new PartnersPage(page);
    await api.signInAs(grace, '/partners');
    await expect(partners.empty).toBeVisible();
    await axe.check();

    await partners.addPartner.click();
    const dialog = new AddPartnerDialog(page);
    await dialog.opened();
    await axe.check();
    await dialog.add.click();
    await expect(dialog.nameError).toBeVisible();

    await dialog.name.fill('Lantern Foundation');
    await dialog.website.fill('lantern.example');
    await dialog.stage.selectOption({ label: 'In Funnel' });
    await dialog.contact.fill('Ada Mwangi');
    await dialog.email.fill('ada@lantern.example');
    await dialog.offering.fill('Grant funding for shelter technology.');
    await dialog.owner.selectOption({ label: 'Grace Okonkwo' });
    await dialog.add.click();

    await expect(dialog.dialog).toBeHidden();
    await expect(partners.column('In Funnel')).toContainText('Lantern Foundation');
    await expect(partners.card('Lantern Foundation')).toContainText(
      'Ada Mwangi · Grant funding for shelter technology.',
    );
    await expect(partners.subtitle).toHaveText('Shared by every lead · 1 partner');
    await axe.check();
  });

  test('a lead opens a partner and edits its details on the partner form', async ({
    page,
    api,
    axe,
  }) => {
    // Tall enough that the whole form fits, so focusing the error summary never scrolls links under
    // the sticky top bar while axe measures target sizes.
    await page.setViewportSize({ width: 1280, height: 1200 });
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    api.addAccount({ email: 'marcus@example.org', name: 'Marcus Lee', roles: ['EventLead'] });
    const kestrel = api.partners.add({
      name: 'Kestrel Labs',
      stage: 'in-funnel',
      contactName: 'Nadia Petrov',
      offering: 'Venue for Builders Night',
      ownerId: grace.profileId,
    });
    const partner = new PartnerPage(page);
    await api.signInAs(grace, `/partners/${kestrel.id}`);
    await expect(partner.stage).toHaveText('In Funnel');
    await expect(partner.detail('Owner')).toHaveText('Grace Okonkwo');
    await axe.check();

    await partner.edit.click();
    const form = new PartnerFormPage(page);
    await expect(form.heading).toHaveText('Edit partner');
    await form.email.fill('nadia@');
    await form.save.click();
    await expect(form.summary).toContainText('Fix 1 thing to save');
    await form.showingErrors();
    await axe.check();

    await form.email.fill('nadia@kestrel.example');
    await form.owner.selectOption({ label: 'Marcus Lee' });
    await form.notes.fill('Studio of 12 developers.');
    await form.save.click();

    await expect(partner.detail('Owner')).toHaveText('Marcus Lee');
    await expect(partner.detail('Email')).toHaveText('nadia@kestrel.example');
    await expect(partner.stage).toHaveText('In Funnel');
  });

  test('Staff see the shared pipeline read-only', async ({ page, api, axe }) => {
    const daniel = api.addAccount({
      email: 'daniel@example.org',
      name: 'Daniel Reyes',
      roles: ['Staff'],
    });
    const kestrel = api.partners.add({ name: 'Kestrel Labs', stage: 'in-funnel' });
    const partners = new PartnersPage(page);
    await api.signInAs(daniel, '/partners');

    await expect(partners.readOnly).toBeVisible();
    await expect(partners.card('Kestrel Labs')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add partner' })).toHaveCount(0);
    await expect(partners.move('Kestrel Labs')).toHaveCount(0);
    await axe.check();

    const partner = new PartnerPage(page);
    await partner.open(kestrel.id);
    await expect(partner.heading).toHaveText('Kestrel Labs');
    await expect(partner.edit).toHaveCount(0);
  });

  test('members without a lead role are told the pipeline is for leads', async ({
    page,
    api,
    axe,
  }) => {
    const ruth = api.addAccount({
      email: 'ruth@example.org',
      name: 'Ruth Alvarez',
      roles: ['Volunteer'],
    });
    const partners = new PartnersPage(page);
    await api.signInAs(ruth, '/partners');

    await expect(partners.forbidden).toBeVisible();
    await axe.check();
  });
});
