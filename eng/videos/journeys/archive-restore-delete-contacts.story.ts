import { expect, test } from '../../../e2e/fixtures/app';
import { ArchiveContactDialog } from '../../../e2e/pages/archive-contact.dialog';
import { ArchivedContactsPage } from '../../../e2e/pages/archived-contacts.page';
import { ContactPage } from '../../../e2e/pages/contact.page';
import { ContactsPage } from '../../../e2e/pages/contacts.page';
import { DeleteContactDialog } from '../../../e2e/pages/delete-contact.dialog';
import { Presenter, typeInto } from '../presenter';

// Journey: archive, restore and delete contacts
// (docs/detailed-designs/contacts/archive-restore-delete-contacts, L2-016).
test('archive-restore-delete-contacts', async ({ page, api }) => {
  const show = await Presenter.start(page, 'archive-restore-delete-contacts');
  const contact = new ContactPage(page);
  const contacts = new ContactsPage(page);
  const archived = new ArchivedContactsPage(page);
  const archiveDialog = new ArchiveContactDialog(page);
  const deleteDialog = new DeleteContactDialog(page);
  const grace = api.addAccount({
    email: 'grace@example.org',
    name: 'Grace Okonkwo',
    roles: ['CityLead'],
  });
  const ben = api.contacts.add({
    ownerId: grace.profileId,
    name: 'Ben Carter',
    city: 'Calgary',
    notes: [api.contacts.note('Moved to Calgary.', 10)],
  });
  api.contacts.add({ ownerId: grace.profileId, name: 'Abby Brooks' });
  api.contacts.add({
    ownerId: grace.profileId,
    name: 'Dana Whitfield',
    city: 'Ottawa',
    archivedAtUtc: '2026-10-13T12:00:00Z',
  });

  await show.card(
    'opening',
    'opening',
    ['Archive, restore and delete', 'Recorded against a local fake API · synthetic people'],
    () => api.signInAs(grace, `/contacts/${ben.id}`),
  );

  await show.step('archive', async () => {
    await expect(contact.heading).toHaveText('Ben Carter');
    await contact.archive.click();
    await archiveDialog.opened();
    await expect(archiveDialog.archive).toBeVisible();
  });

  await show.step('gone-from-list', async () => {
    await archiveDialog.archive.click();
    await expect(contacts.items).toHaveCount(1);
    await expect(contacts.item('Ben Carter')).toHaveCount(0);
  });

  await show.step('archived-list', async () => {
    await contacts.archived.click();
    await expect(archived.item('Ben Carter')).toContainText('Archived Wed 21 Oct · Calgary');
  });

  await show.step(
    'restore',
    async () => {
      await archived.restore('Ben Carter').click();
      await expect(archived.toast).toContainText('Ben Carter is back in your contacts.');
      await contacts.open();
      await contacts.item('Ben Carter').getByRole('link').click();
      await expect(contact.notes).toContainText(['Moved to Calgary.']);
    },
    { poster: true },
  );

  await show.step('delete', async () => {
    await archived.open();
    await archived.delete('Dana Whitfield').click();
    await deleteDialog.opened();
    await expect(deleteDialog.delete).toBeDisabled();
    await typeInto(deleteDialog.confirmation, 'delet');
    await deleteDialog.confirmation.blur();
    await expect(deleteDialog.mismatch).toBeVisible();
  });

  await show.step('deleted', async () => {
    await typeInto(deleteDialog.confirmation, 'DELETE');
    await deleteDialog.delete.click();
    await expect(deleteDialog.dialog).toBeHidden();
    await expect(archived.empty).toBeVisible();
  });

  await show.card('closing', 'closing', [
    'Archiving hides a contact and keeps its notes',
    'Restore brings everything back',
    'Deleting is permanent, so you must type DELETE',
  ]);
  await show.finish();
});
