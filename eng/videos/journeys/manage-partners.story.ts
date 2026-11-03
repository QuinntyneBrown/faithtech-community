import { expect, test } from '../../../e2e/fixtures/app';
import { AddPartnerDialog } from '../../../e2e/pages/add-partner.dialog';
import { PartnerFormPage } from '../../../e2e/pages/partner-form.page';
import { PartnerPage } from '../../../e2e/pages/partner.page';
import { PartnersPage } from '../../../e2e/pages/partners.page';
import { featuredPhoto } from '../photos';
import { Presenter, typeInto } from '../presenter';

// Journey: manage partners (docs/detailed-designs/partners/manage-partners, L2-017).
test('manage-partners', async ({ page, api }) => {
  const show = await Presenter.start(page, 'manage-partners');
  const partners = new PartnersPage(page);
  const dialog = new AddPartnerDialog(page);
  const partner = new PartnerPage(page);
  const form = new PartnerFormPage(page);
  const grace = api.addAccount({
    email: 'grace@example.org',
    name: 'Grace Okonkwo',
    roles: ['CityLead'],
  });
  api.addAccount({ email: 'marcus@example.org', name: 'Marcus Lee', roles: ['EventLead'] });
  api.profiles.get(grace.profileId)!.photos.push(featuredPhoto('grace-okonkwo'));
  for (const [title, minutesAgo] of [
    ['Marcus Lee published Builders Night', 5],
    ['Tomás Ortega just joined FaithTech', 40],
    ['Toronto Builders Night changed. Check the new details.', 90],
  ] as const) {
    api.notifications.add({ recipientId: grace.profileId, title }, minutesAgo);
  }

  await show.card(
    'opening',
    'opening',
    ['Track your partners', 'Recorded against a local fake API · synthetic organisations'],
    () => api.signInAs(grace, '/partners'),
  );

  await show.step('empty', async () => {
    await expect(partners.empty).toBeVisible();
  });

  await show.step('missing-name', async () => {
    await partners.addPartner.click();
    await dialog.opened();
    await typeInto(dialog.website, 'lantern.example');
    await typeInto(dialog.contact, 'Ada Mwangi');
    await typeInto(dialog.email, 'ada@lantern.example');
    await dialog.add.click();
    await expect(dialog.nameError).toBeVisible();
    await dialog.scrollToTop();
  });

  await show.step(
    'fill',
    async () => {
      await typeInto(dialog.name, 'Lantern Foundation');
      await dialog.stage.selectOption({ label: 'In Funnel' });
      await typeInto(dialog.offering, 'Grant funding for shelter technology.');
      await dialog.owner.selectOption({ label: 'Grace Okonkwo' });
      await dialog.scrollToTop();
    },
    { poster: true },
  );

  await show.step('on-board', async () => {
    await dialog.add.click();
    await expect(dialog.dialog).toBeHidden();
    await expect(partners.column('In Funnel')).toContainText('Lantern Foundation');
    await expect(partners.subtitle).toHaveText('Shared by every lead · 1 partner');
  });

  await show.step('partner-page', async () => {
    await partners.card('Lantern Foundation').getByRole('link').click();
    await expect(partner.heading).toHaveText('Lantern Foundation');
    await expect(partner.stage).toHaveText('In Funnel');
    await expect(partner.detail('Owner')).toHaveText('Grace Okonkwo');
  });

  await show.step('edit', async () => {
    await partner.edit.click();
    await expect(form.heading).toHaveText('Edit partner');
  });

  await show.step('save', async () => {
    await typeInto(form.email, 'ada@');
    await form.save.click();
    await expect(form.summary).toContainText('Fix 1 thing to save');
    await typeInto(form.email, 'ada@lantern.example');
    await form.owner.selectOption({ label: 'Marcus Lee' });
    await form.save.click();
    await expect(partner.detail('Owner')).toHaveText('Marcus Lee');
  });

  await show.card('closing', 'closing', [
    'One partner list shared by every lead',
    'Add a partner at the stage it is at',
    'Edit details and owner any time',
  ]);
  await show.finish();
});
