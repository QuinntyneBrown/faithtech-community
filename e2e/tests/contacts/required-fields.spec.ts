// Traces to: L2-013, L2-014, L2-044 (docs/design-system/components/form-field.html: required
// fields are conveyed as required, optional fields are marked "(optional)").
import { expect, test } from '../../fixtures/app';
import { requiredStates } from '../../pages/accessibility-tree';
import { AddNoteDialog } from '../../pages/add-note.dialog';
import { ContactFormPage } from '../../pages/contact-form.page';
import { ContactPage } from '../../pages/contact.page';

test.describe('Contacts required fields', () => {
  test('the contact form and the add-note dialog announce what is required', async ({
    page,
    api,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const tomas = api.contacts.add({ ownerId: grace.profileId, name: 'Tomás Ortega' });
    const form = new ContactFormPage(page);
    await api.signInAs(grace, '/contacts/new');
    await expect(form.name).toBeVisible();
    expect(await requiredStates(page)).toMatchObject({
      Name: true,
      'Email (optional)': false,
      'Phone (optional)': false,
      'Organisation (optional)': false,
      'City (optional)': false,
    });

    const contact = new ContactPage(page);
    await page.goto(`/contacts/${tomas.id}`);
    await contact.addNote.click();
    const dialog = new AddNoteDialog(page);
    await dialog.opened();
    expect(await requiredStates(page)).toMatchObject({ Note: true });
  });
});
