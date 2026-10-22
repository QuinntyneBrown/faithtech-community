// Traces to: L2-094, L2-099 AC6 (docs/detailed-designs/notes/pages-and-list)
import { expect, test } from '../../fixtures/app';
import { NotePage } from '../../pages/note.page';

test.describe('Notes: edit conflicts', () => {
  test('a page changed elsewhere refuses the save, pauses editing and reloads the latest', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const priya = api.addAccount({
      email: 'priya@example.org',
      name: 'Priya Shah',
      roles: ['SystemAdmin'],
    });
    const sheet = api.notes.add({
      title: 'Run sheet',
      ownerId: grace.profileId,
      blocks: [{ id: 'b', type: 'paragraph', text: [{ text: 'Doors open at 6' }] }],
    });
    await api.signInAs(grace, `/notes/${sheet.id}`);
    const note = new NotePage(page);
    await expect(note.textBlock(0)).toHaveText('Doors open at 6');
    api.notes.editElsewhere(sheet, priya.profileId, 'Doors open at 6:30');

    await note.placeCaret(0, 15);
    await page.keyboard.type(' sharp');

    await expect(note.conflict).toContainText('This page changed somewhere else');
    await expect(note.conflict).toContainText('Priya Shah saved a newer version at');
    await expect(note.conflict).toContainText('Your last changes weren’t saved.');
    await expect(note.content.getByRole('textbox')).toHaveCount(0);
    await expect(note.content).toContainText('Doors open at 6 sharp');
    expect(api.notes.texts(sheet)).toEqual(['Doors open at 6:30']);
    await axe.check();

    await note.reload.click();
    await expect(note.conflict).toBeHidden();
    await expect(note.textBlock(0)).toHaveText('Doors open at 6:30');
    await note.placeCaret(0, 18);
    await page.keyboard.type('!');
    await expect(note.saveStatus).toHaveText('Saved');
    expect(api.notes.texts(sheet)).toEqual(['Doors open at 6:30!']);
  });

  test('a save refused because access changed stops editing and says so', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const sheet = api.notes.add({ title: 'Run sheet', ownerId: grace.profileId });
    api.on('PUT', `/api/notes/${sheet.id}`, (route) => route.fulfill({ status: 403 }));
    await api.signInAs(grace, `/notes/${sheet.id}`);
    const note = new NotePage(page);

    await note.textBlock(0).click();
    await page.keyboard.type('Doors open at 6');

    await expect(note.conflict).toContainText('You can’t change this page');
    await expect(note.conflict).toContainText(
      'Your access changed while you were editing. Your last changes weren’t saved.',
    );
    await axe.check();
  });
});
