import { expect, test } from '../../../e2e/fixtures/app';
import { ContactFormPage } from '../../../e2e/pages/contact-form.page';
import { ContactPage } from '../../../e2e/pages/contact.page';
import { ContactsPage } from '../../../e2e/pages/contacts.page';
import { Presenter, typeInto } from '../presenter';

// Journey: manage private contacts (docs/detailed-designs/contacts/manage-contacts, L2-012, L2-013).
test('manage-contacts', async ({ page, api }) => {
  const show = await Presenter.start(page, 'manage-contacts');
  const contacts = new ContactsPage(page);
  const form = new ContactFormPage(page);
  const contact = new ContactPage(page);
  const grace = api.addAccount({
    email: 'grace@example.org',
    name: 'Grace Okonkwo',
    roles: ['CityLead'],
  });
  api.contacts.add({
    ownerId: grace.profileId,
    name: 'Tomás Ortega',
    organization: 'Harbour Light Shelter',
    city: 'Toronto',
    notes: [api.contacts.note('Interested in a dashboard for bed availability.', 3)],
  });
  api.contacts.add({
    ownerId: grace.profileId,
    name: 'Abby Brooks',
    organization: 'Ellis Design Studio',
  });

  await show.card(
    'opening',
    'opening',
    ['Your private contacts', 'Recorded against a local fake API · synthetic people'],
    () => api.signInAs(grace, '/contacts'),
  );

  await show.step('list', async () => {
    await expect(contacts.items).toHaveCount(2);
    await expect(contacts.subtitle).toHaveText('Private to you · 2 contacts');
  });

  await show.step('search', async () => {
    await typeInto(contacts.search, 'bed availability');
    await contacts.search.press('Enter');
    await expect(contacts.items).toHaveCount(1);
    await expect(contacts.item('Tomás Ortega')).toBeVisible();
    await contacts.search.clear();
    await contacts.search.press('Enter');
    await expect(contacts.items).toHaveCount(2);
  });

  await show.step('add', async () => {
    await contacts.addContact.click();
    await expect(form.heading).toHaveText('New contact');
    await typeInto(form.email, 'kwame@');
    await form.save.click();
    await expect(form.summary).toContainText('Fix 2 things to save');
  });

  await show.step(
    'fill',
    async () => {
      await typeInto(form.name, 'Kwame Asante');
      await typeInto(form.email, 'kwame.asante@example.org');
      await typeInto(form.organisation, 'Maple Street Church');
      await typeInto(form.city, 'Toronto');
      await typeInto(form.firstNote, 'Pastor. Interested in hosting a builders night.');
      await form.save.click();
      await expect(contact.heading).toHaveText('Kwame Asante');
      await expect(contact.subtitle).toHaveText('Private contact · only you can see this');
    },
    { poster: true },
  );

  await show.step('edit', async () => {
    await contact.edit.click();
    await expect(form.heading).toHaveText('Edit contact');
    await typeInto(form.phone, '416-555-0142');
    await form.save.click();
    await expect(contact.detail('Phone')).toHaveText('416-555-0142');
  });

  await show.step('in-list', async () => {
    await contacts.open();
    await expect(contacts.item('Kwame Asante')).toContainText('Maple Street Church · Toronto');
    await expect(contacts.item('Kwame Asante')).toContainText('Private');
  });

  await show.card('closing', 'closing', [
    'Contacts are private to the lead who adds them',
    'Search by name, organisation or note',
    'Add and edit with clear inline errors',
  ]);
  await show.finish();
});
