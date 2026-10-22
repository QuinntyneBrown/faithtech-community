// Traces to: L2-015, L2-013 AC6 (docs/detailed-designs/contacts/link-contact-on-sign-up)
import { expect, test } from '../../fixtures/app';
import { ContactFormPage } from '../../pages/contact-form.page';
import { ContactPage } from '../../pages/contact.page';
import { ContactsPage } from '../../pages/contacts.page';
import { LinkContactDialog } from '../../pages/link-contact.dialog';

test.describe('Link a contact on sign-up', () => {
  test('a lead links a contact who joined and keeps their private notes', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    api.addAccount({ email: 'tomas.ortega@example.org', name: 'Tomás Ortega' });
    const tomas = api.contacts.add({
      ownerId: grace.profileId,
      name: 'Tomás Ortega',
      email: 'tomas.ortega@example.org',
      notes: [api.contacts.note('Runs IT at Harbour Light Shelter.', 5)],
    });
    const contacts = new ContactsPage(page);
    await api.signInAs(grace, '/contacts');
    await expect(contacts.joinedAlert).toContainText('Tomás Ortega just joined FaithTech');
    await expect(contacts.item('Tomás Ortega')).toContainText('Signed up');

    await page.goto(`/contacts/${tomas.id}`);
    const contact = new ContactPage(page);
    await expect(contact.matchAlert).toBeVisible();
    await axe.check();
    await contact.linkToProfile.click();
    const dialog = new LinkContactDialog(page);
    await dialog.opened();
    await expect(dialog.keepNotes).toBeChecked();
    await axe.check();
    await dialog.link.click();

    await expect(contact.linkedAlert).toContainText('Linked to Tomás Ortega’s member profile');
    await expect(contact.subtitle).toHaveText('Member · linked profile');
    await expect(contact.notes).toContainText(['Runs IT at Harbour Light Shelter.']);
    expect(api.callsTo('POST', `/api/contacts/${tomas.id}/link`)[0].body).toEqual({
      profileId: 'profile-2',
      discardNotes: false,
    });
  });

  test('“Not them” hides the match until the lead comes back', async ({ page, api }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    api.addAccount({ email: 'tomas.ortega@example.org', name: 'Tomás Ortega' });
    const tomas = api.contacts.add({
      ownerId: grace.profileId,
      name: 'Tomás Ortega',
      email: 'tomas.ortega@example.org',
    });
    const contact = new ContactPage(page);
    await api.signInAs(grace, `/contacts/${tomas.id}`);

    await contact.notThem.click();
    await expect(contact.matchAlert).toHaveCount(0);

    await contact.open(tomas.id);
    await expect(contact.linkToProfile).toBeVisible();
  });

  test('a new contact with a member’s email is saved linked to them', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    api.addAccount({ email: 'kwame.asante@example.org', name: 'Kwame Asante' });
    const form = new ContactFormPage(page);
    await api.signInAs(grace, '/contacts/new');

    await form.name.fill('Kwame');
    await form.email.fill('kwame.asante@example.org');
    await form.save.click();
    await expect(form.memberAlert).toContainText('Kwame Asante is already a member');
    await axe.check();
    await form.saveAndLink.click();

    const contact = new ContactPage(page);
    await expect(contact.heading).toHaveText('Kwame Asante');
    await expect(contact.subtitle).toHaveText('Member · linked profile');
  });
});
