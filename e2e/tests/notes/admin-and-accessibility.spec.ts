// Traces to: L2-098 AC5, L2-099 AC9-AC11 with L2-044, L2-045 (docs/detailed-designs/notes/share-and-visibility)
import { expect, test } from '../../fixtures/app';
import { ArchivedNotesPage } from '../../pages/archived-notes.page';
import { ShareNoteDialog } from '../../pages/note.dialogs';
import { NotePage } from '../../pages/note.page';
import { NotesPage } from '../../pages/notes.page';
import {
  BREAKPOINTS,
  BreakpointName,
  hasHorizontalScroll,
  undersizedTargets,
} from '../../pages/viewport';

test('a System Admin edits someone else’s private page under a banner saying so', async ({
  page,
  api,
  axe,
}) => {
  const grace = api.addAccount({
    email: 'grace@example.org',
    name: 'Grace Okonkwo',
    roles: ['CityLead'],
  });
  const priya = api.addAccount({
    email: 'priya@example.org',
    name: 'Priya Shah',
    roles: ['SystemAdmin'],
  });
  const secret = api.notes.add({
    title: 'Partner meeting notes',
    ownerId: grace.profileId,
    blocks: [{ id: 'b', type: 'paragraph', text: [{ text: 'Shopify, 14 Oct' }] }],
  });
  await api.signInAs(priya, `/notes/${secret.id}`);
  const note = new NotePage(page);

  await expect(note.banner).toContainText('You’re viewing this as System Admin');
  await expect(note.banner).toContainText(
    'Grace Okonkwo owns this page. Every change you make is written to the audit log.',
  );
  await axe.check();
  await note.placeCaret(0, 15);
  await page.keyboard.type(' (follow up)');
  await expect(note.saveStatus).toHaveText('Saved');
  expect(api.notes.texts(secret)).toEqual(['Shopify, 14 Oct (follow up)']);
});

for (const name of Object.keys(BREAKPOINTS) as BreakpointName[]) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`the notes screens fit, keep 24px targets and pass axe at ${name} in ${colorScheme}`, async ({
      page,
      api,
      axe,
    }) => {
      await page.setViewportSize(BREAKPOINTS[name]);
      await page.emulateMedia({ colorScheme });
      const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
      const marcus = api.addAccount({ email: 'marcus@example.org', name: 'Marcus Lee' });
      const playbook = api.notes.add({
        title: 'Toronto city team playbook with a long title that wraps on phones',
        icon: '📘',
        ownerId: grace.profileId,
        visibility: 'Shared',
        memberIds: [marcus.profileId],
        blocks: [
          { id: 'h', type: 'heading1', text: [{ text: 'Our rhythm' }] },
          { id: 'p', type: 'paragraph', text: [{ text: 'Start ' }, { text: 'here', bold: true }] },
          { id: 'l', type: 'bulleted', text: [{ text: 'Builders Night on the first Thursday' }] },
          { id: 't', type: 'todo', checked: true, text: [{ text: 'Book Kestrel Labs' }] },
          { id: 'q', type: 'quote', text: [{ text: 'Work at it with all your heart.' }] },
          { id: 'c', type: 'callout', icon: '💡', text: [{ text: 'Shadow Marcus on the door.' }] },
          {
            id: 'k',
            type: 'code',
            text: [
              {
                text: 'Hi {name}, thanks for joining Builders Night! Doors 6:00 pm · Talks 6:30 pm',
              },
            ],
          },
          { id: 'd', type: 'divider' },
          {
            id: 'u',
            type: 'link',
            url: 'https://docs.google.com/spreadsheets/d/1',
            caption: 'Volunteer rota',
          },
        ],
      });
      api.notes.add({
        title: 'Old notes',
        ownerId: grace.profileId,
        archivedAt: '2026-10-13T12:00:00.000Z',
      });

      await api.signInAs(grace, '/notes');
      const notes = new NotesPage(page);
      await expect(notes.items).toHaveCount(1);
      expect(await hasHorizontalScroll(page), 'notes').toBe(false);
      expect(await undersizedTargets(page), 'notes').toEqual([]);
      await axe.check();

      const note = new NotePage(page);
      await note.open(playbook.id);
      await expect(note.title).toBeVisible();
      expect(await hasHorizontalScroll(page), 'editor').toBe(false);
      expect(await undersizedTargets(page), 'editor').toEqual([]);
      await axe.check();

      await note.share.click();
      const share = new ShareNoteDialog(page, playbook.title);
      await expect(share.dialog).toBeVisible();
      expect(await hasHorizontalScroll(page), 'share').toBe(false);
      await axe.check();
      await page.keyboard.press('Escape');

      const archived = new ArchivedNotesPage(page);
      await archived.open();
      await expect(archived.items).toHaveCount(1);
      expect(await hasHorizontalScroll(page), 'archived').toBe(false);
      await axe.check();

      await api.signInAs(marcus, `/notes/${playbook.id}`);
      await expect(note.heading).toBeVisible();
      expect(await hasHorizontalScroll(page), 'read-only').toBe(false);
      await axe.check();
    });
  }
}
