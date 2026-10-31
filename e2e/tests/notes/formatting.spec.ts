// Traces to: L2-088 AC1-AC5, L2-099 AC4 (docs/detailed-designs/notes/block-editor)
import { expect, test } from '../../fixtures/app';
import { LinkDialog } from '../../pages/note.dialogs';
import { NotePage } from '../../pages/note.page';

test.describe('Notes: inline formatting and hyperlinks', () => {
  test('formats a selection with shortcuts and the toolbar', async ({ page, api, axe }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const sheet = api.notes.add({
      title: 'Run sheet',
      ownerId: grace.profileId,
      blocks: [{ id: 'b1', type: 'paragraph', text: [{ text: 'Doors open at 6' }] }],
    });
    await api.signInAs(grace, `/notes/${sheet.id}`);
    const note = new NotePage(page);

    await note.select(0, 6, 10);
    await expect(note.toolbar).toBeVisible();
    await expect(note.toolbarButton('Bold')).toHaveAttribute('aria-pressed', 'false');
    await axe.check();
    await page.keyboard.press('Control+b');
    await expect(note.textBlock(0).locator('strong')).toHaveText('open');
    await expect(note.toolbarButton('Bold')).toHaveAttribute('aria-pressed', 'true');
    await note.toolbarButton('Italic').click();
    await expect(note.textBlock(0).locator('em')).toHaveText('open');

    await note.select(0, 14, 15);
    await page.keyboard.press('Control+e');
    await expect(note.textBlock(0).locator('code')).toHaveText('6');

    await expect(note.saveStatus).toHaveText('Saved');
    expect(sheet.blocks[0].text).toEqual([
      { text: 'Doors ' },
      { text: 'open', bold: true, italic: true },
      { text: ' at ' },
      { text: '6', code: true },
    ]);
  });

  test('links a selection to an https or mailto address, and removes it again', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const sheet = api.notes.add({
      title: 'Playbook',
      ownerId: grace.profileId,
      blocks: [{ id: 'b1', type: 'paragraph', text: [{ text: 'Our public page' }] }],
    });
    await api.signInAs(grace, `/notes/${sheet.id}`);
    const note = new NotePage(page);

    await note.select(0, 4, 15);
    await page.keyboard.press('Control+k');
    const dialog = new LinkDialog(page, 'Add a link');
    await dialog.link.fill('ftp://faithtech.community');
    await dialog.save.click();
    await expect(dialog.dialog).toContainText('Use a link that starts with https:// or mailto:');
    await axe.check();
    await dialog.link.fill('https://faithtech.community');
    await dialog.save.click();
    await expect(dialog.dialog).toBeHidden();
    await expect(note.textBlock(0).getByRole('link')).toHaveAttribute(
      'href',
      'https://faithtech.community',
    );
    await expect(note.saveStatus).toHaveText('Saved');
    expect(sheet.blocks[0].text).toEqual([
      { text: 'Our ' },
      { text: 'public page', href: 'https://faithtech.community' },
    ]);

    await note.placeCaret(0, 8);
    await note.toolbarButton('Remove link').click();
    await expect(note.textBlock(0).getByRole('link')).toHaveCount(0);
    await expect(note.saveStatus).toHaveText('Saved');
    await expect.poll(() => sheet.blocks[0].text).toEqual([{ text: 'Our public page' }]);
  });

  test('readers open a hyperlink in a new tab', async ({ page, api, axe }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const marcus = api.addAccount({ email: 'marcus@example.org', name: 'Marcus Lee' });
    const playbook = api.notes.add({
      title: 'Playbook',
      ownerId: grace.profileId,
      visibility: 'Global',
      blocks: [
        {
          id: 'b1',
          type: 'paragraph',
          text: [
            { text: 'See ' },
            { text: 'our site', href: 'https://faithtech.community' },
            { text: ' or ' },
            { text: 'email us', href: 'mailto:toronto@faithtech.com' },
          ],
        },
      ],
    });
    await api.signInAs(marcus, `/notes/${playbook.id}`);
    const note = new NotePage(page);

    const site = note.content.getByRole('link', { name: 'our site (opens in a new tab)' });
    await expect(site).toHaveAttribute('target', '_blank');
    await expect(site).toHaveAttribute('rel', 'noopener');
    await expect(note.content.getByRole('link', { name: 'email us', exact: true })).toHaveAttribute(
      'href',
      'mailto:toronto@faithtech.com',
    );
    await axe.check();
  });
});
