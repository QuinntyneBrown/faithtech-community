// Traces to: L2-089, L2-099 AC4, AC5, AC7 (docs/detailed-designs/notes/block-editor)
import { expect, test } from '../../fixtures/app';
import { NotePage } from '../../pages/note.page';

const blocks = [
  { id: 'a', type: 'paragraph', text: [{ text: 'Doors open at 6' }] },
  { id: 'b', type: 'heading2', text: [{ text: 'Run sheet' }] },
  { id: 'c', type: 'todo', checked: false, text: [{ text: 'Order food for 40' }] },
];

test.describe('Notes: reorder blocks by drag and by keyboard', () => {
  test('Alt+Shift+arrows move the focused block and announce where it went', async ({
    page,
    api,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const sheet = api.notes.add({ title: 'Run sheet', ownerId: grace.profileId, blocks });
    await api.signInAs(grace, `/notes/${sheet.id}`);
    const note = new NotePage(page);

    await expect(note.handle(1)).toHaveAccessibleName(
      'Move or open the menu for block 1 of 3, Text',
    );
    await note.placeCaret(0, 5);
    await page.keyboard.press('Alt+Shift+ArrowDown');

    await expect(note.textBlocks).toHaveText(['Run sheet', 'Doors open at 6', 'Order food for 40']);
    await expect(note.textBlock(1)).toBeFocused();
    await expect(note.announcement).toHaveText('Moved Text “Doors open at 6” to position 2 of 3');
    await page.keyboard.press('Alt+Shift+ArrowDown');
    await page.keyboard.press('Alt+Shift+ArrowDown');
    await expect(note.announcement).toHaveText('Moved Text “Doors open at 6” to position 3 of 3');

    await expect(note.saveStatus).toHaveText('Saved');
    expect(sheet.blocks.map((b) => b.id)).toEqual(['b', 'c', 'a']);
  });

  test('the block menu moves, duplicates, turns into and deletes a block', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const sheet = api.notes.add({ title: 'Run sheet', ownerId: grace.profileId, blocks });
    await api.signInAs(grace, `/notes/${sheet.id}`);
    const note = new NotePage(page);

    await note.handle(1).click();
    await expect(note.blockMenu).toBeVisible();
    await expect(note.menuItem('Move up')).toBeDisabled();
    await axe.check();
    await note.menuItem('Move down').click();
    await expect(note.textBlocks).toHaveText(['Run sheet', 'Doors open at 6', 'Order food for 40']);
    await expect(note.announcement).toHaveText('Moved Text “Doors open at 6” to position 2 of 3');

    await note.handle(3).click();
    await note.menuItem('Duplicate').click();
    await expect(note.textBlocks).toHaveCount(4);
    await expect(note.textBlock(3)).toBeFocused();

    await note.handle(4).click();
    await note.menuItem('Turn into').press('Enter');
    await note.menuItem('Quote').click();
    await expect(note.textBlockNamed('Quote')).toHaveText('Order food for 40');

    await note.handle(4).click();
    await note.menuItem('Delete').click();
    await expect(note.textBlocks).toHaveCount(3);

    await expect(note.saveStatus).toHaveText('Saved');
    expect(sheet.blocks.map((b) => b.type)).toEqual(['heading2', 'paragraph', 'todo']);
  });

  test('a block is dragged by its handle to a new place', async ({ page, api }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const sheet = api.notes.add({ title: 'Run sheet', ownerId: grace.profileId, blocks });
    await api.signInAs(grace, `/notes/${sheet.id}`);
    const note = new NotePage(page);

    await note.drag(3, 1);

    await expect(note.textBlocks).toHaveText(['Order food for 40', 'Doors open at 6', 'Run sheet']);
    await expect(note.saveStatus).toHaveText('Saved');
    expect(sheet.blocks.map((b) => b.id)).toEqual(['c', 'a', 'b']);
  });

  test('Escape during a drag cancels it and nothing moves', async ({ page, api }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const sheet = api.notes.add({ title: 'Run sheet', ownerId: grace.profileId, blocks });
    await api.signInAs(grace, `/notes/${sheet.id}`);
    const note = new NotePage(page);

    await note.drag(3, 1, { cancel: true });

    await expect(note.textBlocks).toHaveText(['Doors open at 6', 'Run sheet', 'Order food for 40']);
    expect(api.callsTo('PUT', `/api/notes/${sheet.id}`)).toHaveLength(0);
  });

  test('readers get no handles or move shortcuts', async ({ page, api }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const marcus = api.addAccount({ email: 'marcus@example.org', name: 'Marcus Lee' });
    const playbook = api.notes.add({
      title: 'Playbook',
      ownerId: grace.profileId,
      visibility: 'Global',
      blocks,
    });
    await api.signInAs(marcus, `/notes/${playbook.id}`);
    const note = new NotePage(page);

    await expect(note.content).toContainText('Doors open at 6');
    await expect(note.content.getByRole('button', { name: /^Move or open the menu/ })).toHaveCount(
      0,
    );
  });
});
