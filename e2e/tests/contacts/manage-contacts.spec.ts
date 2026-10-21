// Traces to: L2-012, L2-013 (docs/detailed-designs/contacts/manage-contacts)
import { expect, test } from '../../fixtures/app';
import { ContactFormPage } from '../../pages/contact-form.page';
import { ContactPage } from '../../pages/contact.page';
import { ContactsPage } from '../../pages/contacts.page';

test.describe('Manage private contacts', () => {
  test('a lead with no contacts adds one and sees it in their list', async ({ page, api, axe }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const contacts = new ContactsPage(page);
    await api.signInAs(grace, '/contacts');

    await expect(contacts.empty).toBeVisible();
    await axe.check();

    await page.getByRole('link', { name: 'Add your first contact' }).click();
    const form = new ContactFormPage(page);
    await expect(form.heading).toHaveText('New contact');
    await axe.check();
    await form.name.fill('Kwame Asante');
    await form.email.fill('kwame.asante@example.org');
    await form.organisation.fill('Maple Street Church');
    await form.city.fill('Toronto');
    await form.firstNote.fill('Pastor. Interested in hosting a builders night in the spring.');
    await form.save.click();

    const contact = new ContactPage(page);
    await expect(contact.heading).toHaveText('Kwame Asante');
    await expect(contact.subtitle).toHaveText('Private contact · only you can see this');
    await expect(contact.detail('Organisation')).toHaveText('Maple Street Church');
    await axe.check();

    await contacts.open();
    await expect(contacts.item('Kwame Asante')).toContainText('Maple Street Church · Toronto');
    await expect(contacts.item('Kwame Asante')).toContainText('Private');
  });

  test('saving without a name or with a bad email shows inline errors', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const form = new ContactFormPage(page);
    await api.signInAs(grace, '/contacts/new');

    await form.email.fill('kwame@');
    await form.save.click();

    await expect(form.summary).toContainText('Fix 2 things to save');
    await expect(form.error('Enter at least a first name.')).toBeVisible();
    await expect(form.name).toHaveAttribute('aria-invalid', 'true');
    await expect(form.email).toHaveAttribute('aria-invalid', 'true');
    await axe.check();
    expect(api.callsTo('POST', '/api/contacts')).toHaveLength(0);
  });

  test('a lead searches their contacts by name, organisation or note', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const marcus = api.addAccount({
      email: 'marcus@example.org',
      name: 'Marcus Lee',
      roles: ['EventLead'],
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
    api.contacts.add({
      ownerId: marcus.profileId,
      name: 'Ruth Alvarez',
      organization: 'Harbour Coffee',
    });
    const contacts = new ContactsPage(page);
    await api.signInAs(grace, '/contacts');

    await expect(contacts.items).toHaveCount(2);
    await expect(contacts.subtitle).toHaveText('Private to you · 2 contacts');
    await axe.check();

    await contacts.searchFor('bed availability');
    await expect(contacts.items).toHaveCount(1);
    await expect(contacts.item('Tomás Ortega')).toBeVisible();

    await contacts.searchFor('harbour coffee');
    await expect(contacts.noResults('harbour coffee')).toBeVisible();
    await axe.check();
  });

  test('a lead edits a contact', async ({ page, api }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const tomas = api.contacts.add({
      ownerId: grace.profileId,
      name: 'Tomás Ortega',
      email: 'tomas.ortega@example.org',
      city: 'Toronto',
    });
    const contact = new ContactPage(page);
    await api.signInAs(grace, `/contacts/${tomas.id}`);

    await contact.edit.click();
    const form = new ContactFormPage(page);
    await expect(form.heading).toHaveText('Edit contact');
    await expect(form.firstNote).toHaveCount(0);
    await form.phone.fill('416-555-0142');
    await form.save.click();

    await expect(contact.detail('Phone')).toHaveText('416-555-0142');
  });

  test('Staff are told contacts are private to each lead', async ({ page, api, axe }) => {
    const daniel = api.addAccount({
      email: 'daniel@example.org',
      name: 'Daniel Reyes',
      roles: ['Staff'],
    });
    const contacts = new ContactsPage(page);
    await api.signInAs(daniel, '/contacts');

    await expect(contacts.forbidden).toBeVisible();
    await expect(contacts.search).toHaveCount(0);
    await axe.check();
  });

  test('another lead’s contact looks the same as a missing one', async ({ page, api, axe }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const marcus = api.addAccount({
      email: 'marcus@example.org',
      name: 'Marcus Lee',
      roles: ['EventLead'],
    });
    const tomas = api.contacts.add({ ownerId: grace.profileId, name: 'Tomás Ortega' });
    const contact = new ContactPage(page);
    await api.signInAs(marcus, `/contacts/${tomas.id}`);

    await expect(contact.notFound).toBeVisible();
    await expect(page.getByText('Tomás Ortega')).toHaveCount(0);
    await axe.check();
  });
});
