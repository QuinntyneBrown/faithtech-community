// Traces to: L2-097 (docs/detailed-designs/notes/images)
import { expect, test } from '../../fixtures/app';
import { AddImageDialog, AltTextDialog } from '../../pages/note.dialogs';
import { NotePage } from '../../pages/note.page';

/** A 1×1 PNG. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

test.describe('Notes: image blocks', () => {
  test('an image is added with alt text, which is required, and shown with it', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const sheet = api.notes.add({ title: 'Builders Night', ownerId: grace.profileId });
    await api.signInAs(grace, `/notes/${sheet.id}`);
    const note = new NotePage(page);

    await note.textBlock(0).click();
    await page.keyboard.type('/image');
    await page.keyboard.press('Enter');
    const dialog = new AddImageDialog(page);
    await expect(dialog.dialog).toContainText('JPEG, PNG or WebP, up to 5 MB.');
    await dialog.choose({
      name: 'deck.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF'),
    });
    await expect(dialog.dialog).toContainText('Use a JPEG, PNG or WebP image up to 5 MB.');
    await dialog.choose({ name: 'whiteboard.png', mimeType: 'image/png', buffer: PNG });
    await dialog.add.click();
    await expect(dialog.dialog).toContainText('Describe this image');
    await axe.check();
    await dialog.alt.fill('Pairing at the whiteboard');
    await dialog.add.click();

    await expect(dialog.dialog).toBeHidden();
    await expect(
      note.content.getByRole('img', { name: 'Pairing at the whiteboard' }),
    ).toBeVisible();
    await expect(note.saveStatus).toHaveText('Saved');
    expect(sheet.blocks[0]).toMatchObject({ type: 'image', alt: 'Pairing at the whiteboard' });
    await axe.check();

    await note.handle(1).click();
    await note.menuItem('Edit alt text').click();
    const alt = new AltTextDialog(page);
    await expect(alt.alt).toHaveValue('Pairing at the whiteboard');
    await alt.alt.fill('Two builders pairing at the whiteboard');
    await alt.save.click();
    await expect(
      note.content.getByRole('img', { name: 'Two builders pairing at the whiteboard' }),
    ).toBeVisible();
    await expect(note.saveStatus).toHaveText('Saved');
    await expect.poll(() => sheet.blocks[0].alt).toBe('Two builders pairing at the whiteboard');
  });

  test('readers see the image with its alt text', async ({ page, api }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const marcus = api.addAccount({ email: 'marcus@example.org', name: 'Marcus Lee' });
    const sheet = api.notes.add({
      title: 'Builders Night',
      ownerId: grace.profileId,
      visibility: 'Global',
    });
    const image = api.notes.addImage(sheet);
    sheet.blocks = [{ id: 'i', type: 'image', imageId: image, alt: 'The room set up for 40' }];
    await api.signInAs(marcus, `/notes/${sheet.id}`);

    await expect(
      new NotePage(page).content.getByRole('img', { name: 'The room set up for 40' }),
    ).toBeVisible();
  });
});
