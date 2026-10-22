// Traces to: L2-092 AC6-AC8, L2-093, L2-098 AC1-AC2 (docs/detailed-designs/notes/share-and-visibility)
import { expect, test } from '../../fixtures/app';
import { NotificationsPage } from '../../pages/notifications.page';
import { ShareNoteDialog } from '../../pages/note.dialogs';
import { NotePage } from '../../pages/note.page';
import { NotesPage } from '../../pages/notes.page';

test.describe('Notes: share pages', () => {
  test('the owner shares a private page with a member and a role, who are told and can read it', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const hannah = api.addAccount({
      email: 'hannah@example.org',
      name: 'Hannah Kim',
      roles: ['CommunicationsLead'],
    });
    const samuel = api.addAccount({
      email: 'samuel@example.org',
      name: 'Samuel Mensah',
      roles: ['Volunteer'],
    });
    const marcus = api.addAccount({ email: 'marcus@example.org', name: 'Marcus Lee' });
    const plan = api.notes.add({
      title: 'Q4 planning notes',
      ownerId: grace.profileId,
      blocks: [{ id: 'b', type: 'paragraph', text: [{ text: 'Budget first.' }] }],
    });
    await api.signInAs(grace, `/notes/${plan.id}`);
    const note = new NotePage(page);

    await expect(note.banner).toContainText(
      'Only you can see this. System Admin can too, and every time they open it, it’s recorded in the audit log.',
    );
    await note.share.click();
    const dialog = new ShareNoteDialog(page, 'Q4 planning notes');
    await expect(dialog.visibility('Private')).toBeChecked();
    await dialog.visibility('Shared').check();
    await expect(dialog.dialog).toContainText(
      'Everyone you add gets a notification. They can read it, but can’t change it or share it on.',
    );
    await dialog.save.click();
    await expect(dialog.dialog).toContainText(
      'Choose at least one person or role, or pick another visibility.',
    );
    await dialog.sharePerson('han', 'Hannah Kim');
    await dialog.role('Volunteer').check();
    await axe.check();
    await dialog.save.click();
    await expect(dialog.dialog).toBeHidden();
    await expect(note.toast).toContainText('Sharing updated for Q4 planning notes');
    expect(plan).toMatchObject({
      visibility: 'Shared',
      memberIds: [hannah.profileId],
      roles: ['Volunteer'],
    });

    await api.signInAs(samuel, '/notifications');
    await new NotificationsPage(page).open('Grace Okonkwo shared Q4 planning notes with you');
    await expect(note.heading).toHaveText('Q4 planning notes');
    await expect(note.banner).toContainText(
      'Grace Okonkwo shared this with everyone who has the Volunteer role. You can read it, but only Grace Okonkwo can change it.',
    );
    await expect(note.share).toHaveCount(0);
    await axe.check();

    await api.signInAs(hannah, '/notes');
    await expect(new NotesPage(page).item('Q4 planning notes')).toContainText('Shared with you');

    await api.signInAs(marcus, `/notes/${plan.id}`);
    await expect(note.missing).toBeVisible();
    await expect(note.browse).toBeVisible();
    await axe.check();
  });

  test('a Global page tells readers who can change it', async ({ page, api }) => {
    const grace = api.addAccount({ email: 'grace@example.org', name: 'Grace Okonkwo' });
    const marcus = api.addAccount({ email: 'marcus@example.org', name: 'Marcus Lee' });
    const playbook = api.notes.add({
      title: 'Playbook',
      ownerId: grace.profileId,
      visibility: 'Global',
    });
    await api.signInAs(marcus, `/notes/${playbook.id}`);

    await expect(new NotePage(page).banner).toContainText(
      'Only Grace Okonkwo can change this page.',
    );
  });
});
