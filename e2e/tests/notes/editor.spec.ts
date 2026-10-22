// Traces to: L2-086, L2-092 AC6, L2-099 (docs/detailed-designs/notes/pages-and-list)
import { expect, test } from '../../fixtures/app';
import { NotePage } from '../../pages/note.page';

test.describe('Notes: write a page with autosave', () => {
  test('the owner names a page and writes text blocks, saved as they type', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const sheet = api.notes.add({ title: '', ownerId: grace.profileId });
    await api.signInAs(grace, `/notes/${sheet.id}`);
    const note = new NotePage(page);

    await expect(note.title).toBeFocused();
    await expect(note.textBlocks).toHaveCount(1);
    await expect(note.textBlocks.first()).toHaveAttribute(
      'aria-placeholder',
      'Type / for blocks, or [[ to link a page',
    );
    await axe.check();
    await note.title.pressSequentially('Builders Night run sheet');
    await note.title.press('Enter');
    await expect(note.textBlock(0)).toBeFocused();
    await page.keyboard.type('Doors open at 6');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Pizza at 6:30');

    await expect(note.saveStatus).toHaveText('Saved');
    expect(sheet.title).toBe('Builders Night run sheet');
    expect(api.notes.texts(sheet)).toEqual(['Doors open at 6', 'Pizza at 6:30']);
    expect(sheet.version).toBeGreaterThan(1);
    await axe.check();

    await page.reload();
    await expect(note.title).toHaveText('Builders Night run sheet');
    await expect(note.textBlocks).toHaveText(['Doors open at 6', 'Pizza at 6:30']);
  });

  test('Enter splits a block at the caret and Backspace removes an empty one', async ({
    page,
    api,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const sheet = api.notes.add({
      title: 'Run sheet',
      ownerId: grace.profileId,
      blocks: [{ id: 'b1', type: 'paragraph', text: [{ text: 'Doors open at 6' }] }],
    });
    await api.signInAs(grace, `/notes/${sheet.id}`);
    const note = new NotePage(page);

    await note.placeCaret(0, 'Doors open'.length);
    await page.keyboard.press('Enter');
    await expect(note.textBlocks).toHaveText(['Doors open', ' at 6']);
    await expect(note.textBlock(1)).toBeFocused();
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await expect(note.textBlocks).toHaveCount(3);
    await page.keyboard.press('Backspace');
    await expect(note.textBlocks).toHaveCount(2);
    await expect(note.textBlock(1)).toBeFocused();

    await expect(note.saveStatus).toHaveText('Saved');
    expect(api.notes.texts(sheet)).toEqual(['Doors open', ' at 6']);
  });

  test('leaving with changes not yet saved is guarded', async ({ page, api }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const sheet = api.notes.add({ title: 'Run sheet', ownerId: grace.profileId });
    await api.signInAs(grace, `/notes/${sheet.id}`);
    const note = new NotePage(page);

    await note.textBlock(0).click();
    await page.keyboard.type('Doors');
    expect(await note.leavingIsGuarded()).toBe(true);
    await expect(note.saveStatus).toHaveText('Saved');
    expect(await note.leavingIsGuarded()).toBe(false);
  });

  test('a failed save keeps the edits and Retry sends the page again', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const sheet = api.notes.add({ title: 'Run sheet', ownerId: grace.profileId });
    let fail = true;
    api.on('PUT', `/api/notes/${sheet.id}`, (route) =>
      fail ? route.fulfill({ status: 503 }) : api.fallback(route),
    );
    await api.signInAs(grace, `/notes/${sheet.id}`);
    const note = new NotePage(page);

    await note.textBlock(0).click();
    await page.keyboard.type('Doors open at 6');
    await expect(note.saveStatus).toContainText('Couldn’t save');
    await axe.check();
    fail = false;
    await note.retry.click();

    await expect(note.saveStatus).toHaveText('Saved');
    expect(api.notes.texts(sheet)).toEqual(['Doors open at 6']);
  });

  test('a member who does not own the page reads it without editing controls', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const marcus = api.addAccount({
      email: 'marcus@example.org',
      name: 'Marcus Lee',
      roles: ['CityLead'],
    });
    const playbook = api.notes.add({
      title: 'Toronto city team playbook',
      ownerId: grace.profileId,
      visibility: 'Global',
      blocks: [{ id: 'b1', type: 'paragraph', text: [{ text: 'How we run FaithTech Toronto.' }] }],
    });
    await api.signInAs(marcus, `/notes/${playbook.id}`);
    const note = new NotePage(page);

    await expect(note.heading).toHaveText('Toronto city team playbook');
    await expect(note.content).toContainText('How we run FaithTech Toronto.');
    await expect(page.getByRole('textbox')).toHaveCount(0);
    await expect(note.saveStatus).toHaveCount(0);
    await axe.check();
  });
});
