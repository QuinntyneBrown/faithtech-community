import { expect, test } from '../../../e2e/fixtures/app';
import { ContactFormPage } from '../../../e2e/pages/contact-form.page';
import { ContactPage } from '../../../e2e/pages/contact.page';
import { ContactsPage } from '../../../e2e/pages/contacts.page';
import { LinkContactDialog } from '../../../e2e/pages/link-contact.dialog';
import { Presenter, typeInto } from '../presenter';

// Journey: link a contact when they sign up
// (docs/detailed-designs/contacts/link-contact-on-sign-up, L2-015).
test('link-contact-on-sign-up', async ({ page, api }) => {
  const show = await Presenter.start(page, 'link-contact-on-sign-up');
  const contacts = new ContactsPage(page);
  const contact = new ContactPage(page);
  const dialog = new LinkContactDialog(page);
  const form = new ContactFormPage(page);
  const grace = api.addAccount({
    email: 'grace@example.org',
    name: 'Grace Okonkwo',
    roles: ['CityLead'],
  });
  api.addAccount({ email: 'tomas.ortega@example.org', name: 'Tomás Ortega' });
  api.addAccount({ email: 'kwame.asante@example.org', name: 'Kwame Asante' });
  const tomas = api.contacts.add({
    ownerId: grace.profileId,
    name: 'Tomás Ortega',
    email: 'tomas.ortega@example.org',
    notes: [api.contacts.note('Runs IT at Harbour Light Shelter.', 5)],
  });

  await show.card(
    'opening',
    'opening',
    ['A contact becomes a member', 'Recorded against a local fake API · synthetic people'],
    () => api.signInAs(grace, '/contacts'),
  );

  await show.step('joined', async () => {
    await expect(contacts.joinedAlert).toContainText('Tomás Ortega just joined FaithTech');
    await expect(contacts.item('Tomás Ortega')).toContainText('Signed up');
  });

  await show.step('match', async () => {
    await contacts.item('Tomás Ortega').getByRole('link').click();
    await expect(contact.heading).toHaveText('Tomás Ortega');
    await expect(contact.matchAlert).toBeVisible();
  });

  await show.step('link-dialog', async () => {
    await contact.linkToProfile.click();
    await dialog.opened();
    await expect(dialog.keepNotes).toBeChecked();
  });

  await show.step(
    'linked',
    async () => {
      await dialog.link.click();
      await expect(contact.linkedAlert).toContainText('Linked to Tomás Ortega’s member profile');
      await expect(contact.subtitle).toHaveText('Member · linked profile');
      await expect(contact.notes).toContainText(['Runs IT at Harbour Light Shelter.']);
    },
    { poster: true },
  );

  await show.step('new-contact-member', async () => {
    await form.openNew();
    await typeInto(form.name, 'Kwame');
    await typeInto(form.email, 'kwame.asante@example.org');
    await form.save.click();
    await expect(form.memberAlert).toContainText('Kwame Asante is already a member');
    await form.saveAndLink.click();
    await expect(contact.heading).toHaveText('Kwame Asante');
    await expect(contact.subtitle).toHaveText('Member · linked profile');
  });

  await show.card('closing', 'closing', [
    'You are told when a contact joins',
    'Linking keeps your private notes private',
    'A new contact who is already a member links straight away',
  ]);
  await show.finish();
});
