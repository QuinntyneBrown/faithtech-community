// Traces to: L2-016 (docs/detailed-designs/contacts/archive-restore-delete-contacts)
import { expect, test } from '../../fixtures/app';
import { ArchiveContactDialog } from '../../pages/archive-contact.dialog';
import { ArchivedContactsPage } from '../../pages/archived-contacts.page';
import { ContactPage } from '../../pages/contact.page';
import { ContactsPage } from '../../pages/contacts.page';
import { DeleteContactDialog } from '../../pages/delete-contact.dialog';

test.describe('Archive, restore and delete contacts', () => {
  test('an archived contact leaves the list and can be restored with its notes', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const ben = api.contacts.add({
      ownerId: grace.profileId,
      name: 'Ben Carter',
      city: 'Calgary',
      notes: [api.contacts.note('Moved to Calgary.', 10)],
    });
    api.contacts.add({ ownerId: grace.profileId, name: 'Abby Brooks' });
    const contact = new ContactPage(page);
    await api.signInAs(grace, `/contacts/${ben.id}`);

    await contact.archive.click();
    const dialog = new ArchiveContactDialog(page);
    await dialog.opened();
    await axe.check();
    await dialog.archive.click();

    const contacts = new ContactsPage(page);
    await expect(contacts.items).toHaveCount(1);
    await expect(contacts.item('Ben Carter')).toHaveCount(0);

    await contacts.archived.click();
    const archived = new ArchivedContactsPage(page);
    await expect(archived.item('Ben Carter')).toContainText('Archived Wed 21 Oct · Calgary');
    await axe.check();
    await archived.restore('Ben Carter').click();
    await expect(archived.toast).toContainText('Ben Carter is back in your contacts.');
    await expect(archived.empty).toBeVisible();

    await contacts.open();
    await contacts.item('Ben Carter').getByRole('link').click();
    await expect(contact.notes).toContainText(['Moved to Calgary.']);
  });

  test('deleting needs DELETE typed exactly and removes the contact for good', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    api.contacts.add({
      ownerId: grace.profileId,
      name: 'Ben Carter',
      archivedAtUtc: '2026-10-13T12:00:00Z',
      notes: [api.contacts.note('Moved to Calgary.', 10)],
    });
    const archived = new ArchivedContactsPage(page);
    await api.signInAs(grace, '/contacts/archived');

    await archived.delete('Ben Carter').click();
    const dialog = new DeleteContactDialog(page);
    await dialog.opened();
    await expect(dialog.delete).toBeDisabled();
    await dialog.confirmation.fill('delet');
    await dialog.confirmation.blur();
    await expect(dialog.mismatch).toBeVisible();
    await expect(dialog.delete).toBeDisabled();
    await axe.check();

    await dialog.confirmation.fill('DELETE');
    await dialog.delete.click();

    await expect(dialog.dialog).toBeHidden();
    await expect(archived.empty).toBeVisible();
    expect(api.contacts.contacts).toHaveLength(0);
  });
});
