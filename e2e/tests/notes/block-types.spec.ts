// Traces to: L2-087, L2-088 AC6-AC9, L2-099 AC3 (docs/detailed-designs/notes/block-editor)
import { expect, test } from '../../fixtures/app';
import { LinkCardDialog } from '../../pages/note.dialogs';
import { NotePage } from '../../pages/note.page';

test.describe('Notes: block types, shortcuts and the slash menu', () => {
  test('markdown shortcuts turn a Text block into another type', async ({ page, api, axe }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const sheet = api.notes.add({ title: 'Run sheet', ownerId: grace.profileId });
    await api.signInAs(grace, `/notes/${sheet.id}`);
    const note = new NotePage(page);

    await note.textBlock(0).click();
    for (const [marker, text] of [
      ['# ', 'Our rhythm'],
      ['- ', 'Builders Night'],
      ['1. ', 'Confirm the room'],
      ['[] ', 'Order food'],
      ['> ', 'Work with all your heart'],
    ]) {
      await page.keyboard.type(marker + text);
      await page.keyboard.press('Enter');
      if (marker !== '# ' && marker !== '> ') await page.keyboard.press('Enter');
    }
    await page.keyboard.type('---');

    await expect(note.textBlockNamed('Heading 1')).toHaveText('Our rhythm');
    await expect(note.textBlockNamed('Bulleted list')).toHaveText('Builders Night');
    await expect(note.textBlockNamed('Numbered list')).toHaveText('Confirm the room');
    await expect(note.textBlockNamed('To-do')).toHaveText('Order food');
    await expect(note.textBlockNamed('Quote')).toHaveText('Work with all your heart');
    await expect(note.content.getByRole('separator')).toHaveCount(1);
    await expect(note.saveStatus).toHaveText('Saved');
    expect(sheet.blocks.map((b) => b.type)).toEqual([
      'heading1',
      'bulleted',
      'numbered',
      'todo',
      'quote',
      'divider',
      'paragraph',
    ]);
    await axe.check();
  });

  test('the slash menu inserts a block by keyboard and filters by name', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const sheet = api.notes.add({ title: 'Run sheet', ownerId: grace.profileId });
    await api.signInAs(grace, `/notes/${sheet.id}`);
    const note = new NotePage(page);

    await note.textBlock(0).click();
    await page.keyboard.type('/');
    await expect(note.slashMenu).toBeVisible();
    await expect(note.slashOptions).toHaveCount(13);
    await axe.check();
    await page.keyboard.type('head');
    await expect(note.slashOptions).toHaveText([/Heading 1/, /Heading 2/, /Heading 3/]);
    await page.keyboard.press('ArrowDown');
    await expect(note.slashOption('Heading 2')).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Enter');
    await expect(note.slashMenu).toBeHidden();
    await expect(note.textBlockNamed('Heading 2')).toBeFocused();
    await page.keyboard.type('Every month');

    await page.keyboard.press('Enter');
    await page.keyboard.type('/zzz');
    await expect(note.slashMenu).toContainText('No matching blocks');
    await page.keyboard.press('Escape');
    await expect(note.slashMenu).toBeHidden();
    await expect(note.textBlock(1)).toHaveText('/zzz');

    await expect(note.saveStatus).toHaveText('Saved');
    expect(api.notes.texts(sheet)).toEqual(['Every month', '/zzz']);
    expect(sheet.blocks[0].type).toBe('heading2');
  });

  test('a to-do is ticked by its checkbox and stays ticked', async ({ page, api }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const sheet = api.notes.add({
      title: 'Run sheet',
      ownerId: grace.profileId,
      blocks: [{ id: 't1', type: 'todo', checked: false, text: [{ text: 'Order food for 40' }] }],
    });
    await api.signInAs(grace, `/notes/${sheet.id}`);
    const note = new NotePage(page);

    await note.checkbox('Order food for 40').check();

    await expect(note.saveStatus).toHaveText('Saved');
    expect(sheet.blocks[0].checked).toBe(true);
    await page.reload();
    await expect(note.checkbox('Order food for 40')).toBeChecked();
  });

  test('a link card is added through its dialog and only takes an https link', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const sheet = api.notes.add({ title: 'Run sheet', ownerId: grace.profileId });
    await api.signInAs(grace, `/notes/${sheet.id}`);
    const note = new NotePage(page);

    await note.textBlock(0).click();
    await page.keyboard.type('/link');
    await page.keyboard.press('Enter');
    const dialog = new LinkCardDialog(page);
    await expect(dialog.dialog).toBeVisible();
    await dialog.link.fill('http://docs.google.com/rota');
    await dialog.add.click();
    await expect(dialog.dialog).toContainText('Use a link that starts with https://.');
    await axe.check();
    await dialog.link.fill('https://docs.google.com/spreadsheets/d/1');
    await dialog.caption.fill('Volunteer rota');
    await dialog.add.click();

    await expect(dialog.dialog).toBeHidden();
    const card = note.content.getByRole('link', { name: 'Volunteer rota (opens in a new tab)' });
    await expect(card).toHaveAttribute('href', 'https://docs.google.com/spreadsheets/d/1');
    await expect(card).toHaveAttribute('rel', 'noopener');
    await expect(note.saveStatus).toHaveText('Saved');
    expect(sheet.blocks.map((b) => b.type)).toContain('link');
  });

  test('the read-only view renders headings, real lists and code', async ({ page, api, axe }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const marcus = api.addAccount({ email: 'marcus@example.org', name: 'Marcus Lee' });
    const playbook = api.notes.add({
      title: 'Playbook',
      ownerId: grace.profileId,
      visibility: 'Global',
      blocks: [
        { id: 'h', type: 'heading1', text: [{ text: 'Our rhythm' }] },
        { id: 'n1', type: 'numbered', text: [{ text: 'Confirm the room' }] },
        { id: 'n2', type: 'numbered', text: [{ text: 'Post the event' }] },
        { id: 'c', type: 'code', text: [{ text: 'Doors 6:00 pm\n  Talks 6:30 pm' }] },
        { id: 't', type: 'todo', checked: true, text: [{ text: 'Book the room' }] },
      ],
    });
    await api.signInAs(marcus, `/notes/${playbook.id}`);
    const note = new NotePage(page);

    await expect(note.content.getByRole('heading', { level: 2 })).toHaveText('Our rhythm');
    await expect(note.content.getByRole('list').getByRole('listitem')).toHaveCount(2);
    await expect(note.content.locator('pre')).toHaveText('Doors 6:00 pm\n  Talks 6:30 pm');
    await expect(note.checkbox('Book the room')).toBeChecked();
    await expect(note.checkbox('Book the room')).toBeDisabled();
    await axe.check();
  });
});
