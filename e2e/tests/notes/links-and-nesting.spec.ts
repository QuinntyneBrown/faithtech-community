// Traces to: L2-085 AC7, L2-090, L2-091 (docs/detailed-designs/notes/links-and-backlinks)
import { expect, test } from '../../fixtures/app';
import { MoveNoteDialog } from '../../pages/note.dialogs';
import { NotePage } from '../../pages/note.page';

test.describe('Notes: page links, backlinks and nesting', () => {
  test('[[ links another page by title, and that page lists it under Linked from', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const sheet = api.notes.add({
      title: 'Builders Night run sheet',
      icon: '🛠️',
      ownerId: grace.profileId,
    });
    api.notes.add({ title: 'Volunteer onboarding checklist', ownerId: grace.profileId });
    const playbook = api.notes.add({ title: 'Playbook', ownerId: grace.profileId });
    await api.signInAs(grace, `/notes/${playbook.id}`);
    const note = new NotePage(page);

    await note.textBlock(0).click();
    await page.keyboard.type('See [[');
    await expect(note.pageSuggestions).toBeVisible();
    await expect(note.pageSuggestions.getByRole('option')).toHaveCount(2);
    await axe.check();
    await page.keyboard.type('run');
    await expect(note.pageSuggestions.getByRole('option')).toHaveCount(1);
    await page.keyboard.press('Enter');
    await expect(note.pageSuggestions).toBeHidden();
    await page.keyboard.type(' first.');

    const link = note.content.getByRole('link', { name: 'Builders Night run sheet' });
    await expect(link).toHaveAttribute('href', `/notes/${sheet.id}`);
    await expect(note.saveStatus).toHaveText('Saved');
    expect(playbook.blocks[0].text).toEqual([
      { text: 'See ' },
      { text: '', pageId: sheet.id },
      { text: ' first.' },
    ]);

    await note.open(sheet.id);
    await expect(note.linkedFrom.getByRole('link', { name: 'Playbook' })).toBeVisible();
    await axe.check();
  });

  test('a reader sees "Private page" for a link or ancestor they cannot open', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const marcus = api.addAccount({ email: 'marcus@example.org', name: 'Marcus Lee' });
    const plans = api.notes.add({ title: 'Grace’s private plans', ownerId: grace.profileId });
    const notesPage = api.notes.add({
      title: 'Partner meeting notes',
      ownerId: grace.profileId,
      parentId: plans.id,
      visibility: 'Global',
      blocks: [
        {
          id: 'b',
          type: 'paragraph',
          text: [{ text: 'Follow-up in ' }, { text: '', pageId: plans.id }],
        },
      ],
    });
    await api.signInAs(marcus, `/notes/${notesPage.id}`);
    const note = new NotePage(page);

    await expect(note.content).toContainText('Follow-up in Private page');
    await expect(note.content.getByRole('link')).toHaveCount(0);
    await expect(note.breadcrumb).toHaveText(/Notes\s*Private page\s*Partner meeting notes/);
    await expect(page.getByText('Grace’s private plans')).toHaveCount(0);
    await axe.check();
  });

  test('New page inside creates a child page, and Move puts a page somewhere else', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const playbook = api.notes.add({
      title: 'Toronto city team playbook',
      ownerId: grace.profileId,
    });
    const other = api.notes.add({ title: 'Partner notes', ownerId: grace.profileId });
    await api.signInAs(grace, `/notes/${playbook.id}`);
    const note = new NotePage(page);

    await expect(note.pagesInside).toContainText('No pages inside yet.');
    await note.newPageInside.click();
    await expect(
      note.breadcrumb.getByRole('link', { name: 'Toronto city team playbook' }),
    ).toBeVisible();
    const child = api.notes.pages.at(-1)!;
    expect(child.parentId).toBe(playbook.id);
    await note.title.pressSequentially('Builders Night run sheet');
    await expect(note.saveStatus).toHaveText('Saved');

    await note.moreActions.click();
    await note.menuItem('Move').click();
    const dialog = new MoveNoteDialog(page, 'Builders Night run sheet');
    await expect(dialog.option('Toronto city team playbook')).toBeChecked();
    await axe.check();
    await dialog.option('Partner notes').check();
    await dialog.move.click();

    await expect(dialog.dialog).toBeHidden();
    await expect(note.toast).toContainText('Builders Night run sheet moved');
    await expect(note.toast).toContainText('It’s now inside Partner notes.');
    await expect(note.breadcrumb.getByRole('link', { name: 'Partner notes' })).toBeVisible();
    expect(child.parentId).toBe(other.id);

    await note.open(other.id);
    await expect(
      note.pagesInside.getByRole('link', { name: 'Builders Night run sheet' }),
    ).toBeVisible();
  });
});
