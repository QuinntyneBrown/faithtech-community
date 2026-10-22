import { expect, test } from '../../../e2e/fixtures/app';
import { AddNoteDialog } from '../../../e2e/pages/add-note.dialog';
import { ContactPage } from '../../../e2e/pages/contact.page';
import { Presenter, typeInto } from '../presenter';

// Journey: notes on a contact (docs/detailed-designs/contacts/contact-notes, L2-014).
test('contact-notes', async ({ page, api }) => {
  const show = await Presenter.start(page, 'contact-notes');
  const contact = new ContactPage(page);
  const dialog = new AddNoteDialog(page);
  const grace = api.addAccount({
    email: 'grace@example.org',
    name: 'Grace Okonkwo',
    roles: ['CityLead'],
  });
  const tomas = api.contacts.add({
    ownerId: grace.profileId,
    name: 'Tomás Ortega',
    organization: 'Harbour Light Shelter',
    notes: [api.contacts.note('Met at Builders Night.', 33)],
  });

  await show.card(
    'opening',
    'opening',
    ['Keep notes on your contacts', 'Recorded against a local fake API · synthetic people'],
    () => api.signInAs(grace, `/contacts/${tomas.id}`),
  );

  await show.step('existing', async () => {
    await expect(contact.heading).toHaveText('Tomás Ortega');
    await expect(contact.notes).toHaveCount(1);
  });

  await show.step('open-dialog', async () => {
    await contact.addNote.click();
    await dialog.opened();
    await expect(dialog.note).toBeVisible();
  });

  await show.step('empty-note', async () => {
    await dialog.add.click();
    await expect(dialog.emptyError).toBeVisible();
  });

  await show.step(
    'write',
    async () => {
      await typeInto(dialog.note, 'Wants two staff at the November hackathon.');
      await dialog.add.click();
      await expect(dialog.dialog).toBeHidden();
    },
    { poster: true },
  );

  await show.step('newest-first', async () => {
    await expect(contact.notes).toHaveCount(2);
    await expect(contact.notes.first()).toContainText('Wants two staff at the November hackathon.');
    await expect(contact.notes.first()).toContainText('Wed 21 Oct');
  });

  await show.card('closing', 'closing', [
    'Notes are dated and newest first',
    'Only you and System Admin can read them',
  ]);
  await show.finish();
});
