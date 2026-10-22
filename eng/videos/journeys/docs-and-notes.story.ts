import { expect, test } from '../../../e2e/fixtures/app';
import { ShareNoteDialog } from '../../../e2e/pages/note.dialogs';
import { NotePage } from '../../../e2e/pages/note.page';
import { NotesPage } from '../../../e2e/pages/notes.page';
import { Presenter } from '../presenter';

// Journey: Docs & notes (docs/detailed-designs/notes, L2-085 to L2-099).
test('docs-and-notes', async ({ page, api }) => {
  const show = await Presenter.start(page, 'docs-and-notes');
  const notes = new NotesPage(page);
  const note = new NotePage(page);
  const grace = api.addAccount({
    email: 'grace@example.org',
    name: 'Grace Okonkwo',
    roles: ['CityLead'],
  });
  const marcus = api.addAccount({
    email: 'marcus@example.org',
    name: 'Marcus Lee',
    roles: ['EventLead'],
  });
  api.notes.add(
    { title: 'Hackathon judging how-to', ownerId: marcus.profileId, visibility: 'Global' },
    3,
  );
  const checklist = api.notes.add(
    { title: 'Volunteer onboarding checklist', icon: '✅', ownerId: grace.profileId },
    2,
  );
  api.notes.add({ title: 'Partner meeting notes — 14 Oct', ownerId: grace.profileId }, 1);

  await show.card(
    'opening',
    'opening',
    ['Docs & notes', 'Recorded against a local fake API · synthetic people'],
    () => api.signInAs(grace, '/notes'),
  );

  await show.step('list', async () => {
    await expect(notes.heading).toHaveText('Notes');
    await expect(notes.items).toHaveCount(3);
    await notes.owner('Mine').click();
    await expect(notes.items).toHaveCount(2);
    await notes.owner('All pages').click();
  });

  await show.step('new-page', async () => {
    await notes.newPage.click();
    await expect(note.title).toBeVisible();
    await note.title.click();
    await note.title.pressSequentially('Builders Night run sheet', { delay: 45 });
  });

  await show.step(
    'shortcuts',
    async () => {
      await note.textBlock(0).click();
      for (const [marker, text] of [
        ['# ', 'Before the night'],
        ['[] ', 'Book the room'],
        ['', 'Order food for 40'],
      ]) {
        await page.keyboard.type(marker + text, { delay: 35 });
        await page.keyboard.press('Enter');
      }
      await page.keyboard.press('Enter');
      await expect(note.textBlockNamed('Heading 1')).toHaveText('Before the night');
    },
    { poster: true },
  );

  await show.step('slash', async () => {
    await page.keyboard.type('/', { delay: 35 });
    await expect(note.slashMenu).toBeVisible();
    await page.keyboard.type('quote', { delay: 60 });
    await page.keyboard.press('Enter');
    await expect(note.slashMenu).toBeHidden();
    await page.keyboard.type('Whatever you do, work at it with all your heart.', { delay: 30 });
    await page.keyboard.press('Enter');
  });

  await show.step('link', async () => {
    await page.keyboard.type('New volunteers start with [[', { delay: 35 });
    await expect(note.pageSuggestions).toBeVisible();
    await page.keyboard.type('onboard', { delay: 60 });
    await page.keyboard.press('Enter');
    await expect(
      note.content.getByRole('link', { name: 'Volunteer onboarding checklist' }),
    ).toBeVisible();
    await expect(note.saveStatus).toHaveText('Saved');
  });

  const sheet = api.notes.pages.find((p) => p.title === 'Builders Night run sheet')!;

  await show.step('backlink', async () => {
    await note.open(checklist.id);
    await expect(
      note.linkedFrom.getByRole('link', { name: 'Builders Night run sheet' }),
    ).toBeVisible();
    await note.linkedFrom.scrollIntoViewIfNeeded();
  });

  await show.step(
    'share',
    async () => {
      await note.open(sheet.id);
      await expect(note.banner).toContainText('Only you can see this.');
      await note.share.click();
      const dialog = new ShareNoteDialog(page, 'Builders Night run sheet');
      await dialog.visibility('Shared').check();
      await dialog.sharePerson('mar', 'Marcus Lee');
      await dialog.role('Volunteer').check();
      await dialog.save.click();
      await expect(dialog.dialog).toBeHidden();
      await expect(note.toast).toContainText('Sharing updated');
    },
    { position: 'top' },
  );

  await show.card('closing', 'closing', [
    'Pages start private; share with people, roles or everyone',
    'Links, backlinks and nesting tie your notes together',
  ]);
  await show.finish();
});
