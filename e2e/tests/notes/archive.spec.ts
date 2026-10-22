// Traces to: L2-095 (docs/detailed-designs/notes/archive-and-search)
import { expect, test } from '../../fixtures/app';
import { ArchivedNotesPage } from '../../pages/archived-notes.page';
import { ConfirmNoteDialog } from '../../pages/note.dialogs';
import { NotePage } from '../../pages/note.page';
import { NotesPage } from '../../pages/notes.page';

test.describe('Notes: archive and restore', () => {
  test('the owner archives a page, finds it in Archived and restores it', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const sheet = api.notes.add({
      title: 'Builders Night run sheet',
      ownerId: grace.profileId,
      visibility: 'Global',
    });
    await api.signInAs(grace, `/notes/${sheet.id}`);
    const note = new NotePage(page);

    await note.moreActions.click();
    await note.menuItem('Archive').click();
    const archive = new ConfirmNoteDialog(page, 'Archive', 'Builders Night run sheet');
    await expect(archive.dialog).toContainText(
      'It disappears for everyone who can see it today. Pages inside it stay where they are.',
    );
    await expect(archive.cancel).toBeFocused();
    await axe.check();
    await archive.confirm.click();

    const notes = new NotesPage(page);
    await expect(page).toHaveURL('/notes');
    await expect(notes.toast).toContainText('Builders Night run sheet archived');
    await expect(notes.item('Builders Night run sheet')).toHaveCount(0);
    expect(sheet.archivedAt).not.toBeNull();

    await notes.archived.click();
    const archived = new ArchivedNotesPage(page);
    await expect(archived.heading).toHaveText('Archived pages');
    await expect(archived.items).toHaveCount(1);
    await axe.check();
    await archived.restore('Builders Night run sheet').click();
    const restore = new ConfirmNoteDialog(page, 'Restore', 'Builders Night run sheet');
    await restore.confirm.click();
    await expect(archived.toast).toContainText('Builders Night run sheet restored');
    await expect(archived.empty).toBeVisible();
    expect(sheet.archivedAt).toBeNull();
  });

  test('Undo on the archive toast puts the page straight back', async ({ page, api }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const sheet = api.notes.add({ title: 'Run sheet', ownerId: grace.profileId });
    await api.signInAs(grace, `/notes/${sheet.id}`);
    const note = new NotePage(page);

    await note.moreActions.click();
    await note.menuItem('Archive').click();
    await new ConfirmNoteDialog(page, 'Archive', 'Run sheet').confirm.click();
    const notes = new NotesPage(page);
    await notes.toast.getByRole('button', { name: 'Undo' }).click();

    await expect(page).toHaveURL(`/notes/${sheet.id}`);
    await expect(note.title).toHaveText('Run sheet');
    expect(sheet.archivedAt).toBeNull();
  });

  test('the owner opening an archived page reads it with a Restore banner', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const sheet = api.notes.add({
      title: 'Run sheet',
      ownerId: grace.profileId,
      archivedAt: new Date(Date.UTC(2026, 9, 20, 12)).toISOString(),
      blocks: [{ id: 'b', type: 'paragraph', text: [{ text: 'Doors open at 6' }] }],
    });
    await api.signInAs(grace, `/notes/${sheet.id}`);
    const note = new NotePage(page);

    await expect(note.breadcrumb).toHaveText(/Notes\s*Archived\s*Run sheet/);
    await expect(note.banner).toContainText(
      'Only you can see it. Restore it to edit it or let others see it again.',
    );
    await expect(page.getByRole('textbox')).toHaveCount(0);
    await expect(note.share).toHaveCount(0);
    await axe.check();
    await note.banner.getByRole('button', { name: 'Restore' }).click();
    await new ConfirmNoteDialog(page, 'Restore', 'Run sheet').confirm.click();
    await expect(note.toast).toContainText('Run sheet restored');
    await expect(note.textBlock(0)).toHaveText('Doors open at 6');
  });

  test('shows when the archived list is empty or fails', async ({ page, api, axe }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    let fail = true;
    api.on('GET', '/api/notes/archived', (route) =>
      fail ? route.fulfill({ status: 503 }) : api.fallback(route),
    );
    await api.signInAs(grace, '/notes/archived');
    const archived = new ArchivedNotesPage(page);

    await expect(archived.error).toBeVisible();
    await axe.check();
    fail = false;
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(archived.empty).toBeVisible();
  });
});
