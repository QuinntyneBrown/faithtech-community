// Traces to: L2-014 (docs/detailed-designs/contacts/contact-notes)
import { expect, test } from '../../fixtures/app';
import { AddNoteDialog } from '../../pages/add-note.dialog';
import { ContactPage } from '../../pages/contact.page';

test.describe('Contact notes', () => {
  test('the owning lead adds a note and it is shown first with its date', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const tomas = api.contacts.add({
      ownerId: grace.profileId,
      name: 'Tomás Ortega',
      notes: [api.contacts.note('Met at Builders Night.', 33)],
    });
    const contact = new ContactPage(page);
    await api.signInAs(grace, `/contacts/${tomas.id}`);
    await expect(contact.notes).toHaveCount(1);
    await axe.check();

    await contact.addNote.click();
    const dialog = new AddNoteDialog(page);
    await dialog.opened();
    await axe.check();
    await dialog.add.click();
    await expect(dialog.emptyError).toBeVisible();
    await dialog.note.fill('Wants two staff at the November hackathon.');
    await dialog.add.click();

    await expect(dialog.dialog).toBeHidden();
    await expect(contact.notes.first()).toContainText('Wants two staff at the November hackathon.');
    await expect(contact.notes.first()).toContainText('Wed 21 Oct');
    await expect(contact.notes).toHaveCount(2);
  });

  test('a linked contact keeps the lead’s private notes', async ({ page, api }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const member = api.addAccount({ email: 'tomas.ortega@example.org', name: 'Tomás Ortega' });
    const tomas = api.contacts.add({
      ownerId: grace.profileId,
      name: 'Tomás Ortega',
      email: 'tomas.ortega@example.org',
      linkedProfileId: member.profileId,
      notes: [api.contacts.note('Private follow-up.', 2)],
    });
    const contact = new ContactPage(page);
    await api.signInAs(grace, `/contacts/${tomas.id}`);

    await expect(contact.subtitle).toHaveText('Member · linked profile');
    await expect(contact.notes).toContainText(['Private follow-up.']);
  });
});
