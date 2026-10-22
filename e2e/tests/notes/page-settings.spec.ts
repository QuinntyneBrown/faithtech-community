// Traces to: L2-086 AC3, L2-087 AC6 (docs/detailed-designs/notes/pages-and-list)
import { expect, test } from '../../fixtures/app';
import { IconDialog, PageSettingsDialog } from '../../pages/note.dialogs';
import { NotePage } from '../../pages/note.page';
import { NotesPage } from '../../pages/notes.page';

test.describe('Notes: page settings and icons', () => {
  test('the owner renames a page and gives it an icon from Page settings', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const sheet = api.notes.add({ title: 'Run sheet', ownerId: grace.profileId });
    await api.signInAs(grace, `/notes/${sheet.id}`);
    const note = new NotePage(page);

    await note.moreActions.click();
    await note.menuItem('Page settings').click();
    const dialog = new PageSettingsDialog(page);
    await expect(dialog.title).toHaveValue('Run sheet');
    await expect(dialog.icon('No icon')).toBeChecked();
    await axe.check();
    await dialog.title.fill('Builders Night run sheet');
    await dialog.icon('Hammer and wrench').check();
    await dialog.save.click();

    await expect(dialog.dialog).toBeHidden();
    await expect(note.title).toHaveText('Builders Night run sheet');
    await expect(note.icon).toHaveText('🛠️');
    await expect(note.saveStatus).toHaveText('Saved');
    expect(sheet).toMatchObject({ title: 'Builders Night run sheet', icon: '🛠️' });

    await new NotesPage(page).open();
    await expect(new NotesPage(page).item('Builders Night run sheet')).toContainText('🛠️');
  });

  test('a callout’s icon is changed from its block menu', async ({ page, api, axe }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const sheet = api.notes.add({
      title: 'Run sheet',
      ownerId: grace.profileId,
      blocks: [{ id: 'c', type: 'callout', icon: '💡', text: [{ text: 'Shadow Marcus' }] }],
    });
    await api.signInAs(grace, `/notes/${sheet.id}`);
    const note = new NotePage(page);

    await note.handle(1).click();
    await note.menuItem('Change icon').click();
    const dialog = new IconDialog(page);
    await expect(dialog.icon('Light bulb')).toBeChecked();
    await axe.check();
    await dialog.icon('Compass').check();
    await dialog.save.click();

    await expect(note.content.locator('.callout__icon')).toHaveText('🧭');
    await expect(note.saveStatus).toHaveText('Saved');
    expect(sheet.blocks[0].icon).toBe('🧭');
  });
});
