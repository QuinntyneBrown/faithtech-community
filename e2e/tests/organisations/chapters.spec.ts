// Traces to: L2-140 AC1, AC2, AC3, AC4, AC5, AC6, AC7; L2-147 AC1, AC2; L2-152 AC1
// (docs/detailed-designs/organisations/chapters)
import { expect, test } from '../../fixtures/app';
import { NORTHSIDE } from '../../fixtures/mock-host';
import { ArchiveChapterDialog, ChapterNameDialog } from '../../pages/chapter.dialogs';
import { EditGeneralSettingsDialog } from '../../pages/edit-general-settings.dialog';
import { OrganisationChaptersPage } from '../../pages/organisation-chapters.page';
import { OrganisationGeneralPage } from '../../pages/organisation-general.page';
import { TurnChaptersOffDialog } from '../../pages/turn-chapters-off.dialog';

const SETTINGS = {
  email: 'grace@example.org',
  capabilities: ['ManageOrganisationSettings' as const],
};

test.describe('Organisation settings: chapters', () => {
  test('a settings manager turns chapters on, and the tab takes the plural label', async ({
    page,
    api,
    axe,
  }) => {
    api.host.serve(NORTHSIDE);
    const grace = api.addAccount(SETTINGS);
    const general = new OrganisationGeneralPage(page);
    const chapters = new OrganisationChaptersPage(page);
    await api.signInAs(grace, '/organisation/chapters');

    await expect(chapters.chaptersOff).toBeVisible();
    await expect(chapters.tab('Chapters')).toBeVisible();
    await axe.check();
    await chapters.goToGeneral.click();

    await general.edit.click();
    const dialog = new EditGeneralSettingsDialog(page);
    await expect(dialog.singular).toHaveCount(0);
    await dialog.chapters.check();
    await dialog.singular.fill('Campus');
    await dialog.save.click();
    await expect(dialog.error('Enter the plural label too.')).toBeVisible();
    await axe.check();
    await dialog.plural.fill('Campuses');
    await dialog.save.click();

    await expect(dialog.dialog).toBeHidden();
    await expect(general.value('Chapters')).toHaveText('On, called Campus / Campuses');
    await expect(chapters.tab('Campuses')).toBeVisible();
    expect(api.callsTo('PUT', '/api/organisation').at(-1)!.body).toMatchObject({
      chapterLabel: { singular: 'Campus', plural: 'Campuses' },
    });
    expect(api.audit.at(-1)).toMatchObject({ action: 'organisation.updated' });
  });

  test('a settings manager adds chapters, and a taken name is refused', async ({
    page,
    api,
    axe,
  }) => {
    api.host.serve({ ...NORTHSIDE, chapterLabel: { singular: 'Campus', plural: 'Campuses' } });
    const grace = api.addAccount(SETTINGS);
    const chapters = new OrganisationChaptersPage(page);
    await api.signInAs(grace, '/organisation/chapters');

    await expect(page.getByRole('heading', { name: 'No campuses yet' })).toBeVisible();
    await axe.check();
    for (const name of ['Downtown', 'Riverside']) {
      await chapters.add('Campus').click();
      const add = new ChapterNameDialog(page, 'Add a campus');
      await expect(add.name).toBeFocused();
      await add.name.fill(name);
      await add.save.click();
      await expect(add.dialog).toBeHidden();
      await expect(chapters.toast(`${name} added`)).toBeVisible();
    }
    await expect.poll(() => chapters.names('Campuses')).toEqual(['Downtown', 'Riverside']);
    await expect(chapters.row('Downtown')).toContainText('0 members');

    await chapters.add('Campus').click();
    const add = new ChapterNameDialog(page, 'Add a campus');
    await add.name.fill('downtown');
    await add.save.click();
    await expect(add.error('There’s already a campus called downtown.')).toBeVisible();
    await axe.check();
  });

  test('a settings manager reorders by keyboard, renames and archives a chapter', async ({
    page,
    api,
    axe,
  }) => {
    for (const name of ['Toronto', 'Austin', 'Vancouver']) api.chapters.add(name);
    const grace = api.addAccount(SETTINGS);
    const chapters = new OrganisationChaptersPage(page);
    await api.signInAs(grace, '/organisation/chapters');

    await expect(chapters.tab('Cities')).toBeVisible();
    await expect.poll(() => chapters.names('Cities')).toEqual(['Toronto', 'Austin', 'Vancouver']);
    await expect(chapters.moveUp('Toronto')).toBeDisabled();
    await axe.check();

    await chapters.moveUp('Vancouver').focus();
    await page.keyboard.press('Enter');
    await expect(chapters.announcement).toHaveText('Moved Vancouver up to position 2 of 3.');
    await expect(chapters.moveUp('Vancouver')).toBeFocused();
    await expect.poll(() => chapters.names('Cities')).toEqual(['Toronto', 'Vancouver', 'Austin']);
    await expect.poll(() => api.callsTo('PUT', '/api/organisation/chapters/order').length).toBe(1);
    await page.reload();
    await expect.poll(() => chapters.names('Cities')).toEqual(['Toronto', 'Vancouver', 'Austin']);

    await chapters.rename('Toronto').click();
    const rename = new ChapterNameDialog(page, 'Rename Toronto');
    await expect(rename.name).toHaveValue('Toronto');
    await rename.name.fill('Toronto East');
    await rename.save.click();
    await expect(chapters.toast('Renamed to Toronto East')).toBeVisible();

    await chapters.archive('Austin').click();
    const archive = new ArchiveChapterDialog(page, 'Austin');
    await expect(archive.dialog).toContainText(
      'Members and events keep Austin, but it leaves every picker and filter.',
    );
    await axe.check();
    await archive.confirm.click();
    await expect(chapters.toast('Austin archived')).toBeVisible();
    await expect.poll(() => chapters.names('Cities')).toEqual(['Toronto East', 'Vancouver']);
    await chapters.archived.click();
    await expect(chapters.archivedList('Cities')).toContainText('Austin');
    expect(api.audit.map((a) => a.action)).toEqual(
      expect.arrayContaining(['chapter.reordered', 'chapter.updated', 'chapter.archived']),
    );
  });

  test('turning chapters off asks first, then keeps every chapter for when they come back', async ({
    page,
    api,
    axe,
  }) => {
    api.chapters.add('Toronto');
    const grace = api.addAccount(SETTINGS);
    const general = new OrganisationGeneralPage(page);
    const chapters = new OrganisationChaptersPage(page);
    await api.signInAs(grace, '/organisation');

    await general.edit.click();
    const dialog = new EditGeneralSettingsDialog(page);
    await dialog.chapters.uncheck();
    await dialog.save.click();
    const confirm = new TurnChaptersOffDialog(page, 'Cities');
    await expect(confirm.dialog).toContainText(
      'Members and events keep their city, but nothing will show it until you turn cities back on.',
    );
    await axe.check();
    await confirm.turnOff.click();

    await expect(dialog.dialog).toBeHidden();
    await expect(page.locator('ft-toast').filter({ hasText: 'Cities turned off' })).toBeVisible();
    await expect(general.value('Chapters')).toHaveText('Off');
    await chapters.tab('Chapters').click();
    await expect(chapters.chaptersOff).toBeVisible();
    expect(api.chapters.chapters.map((c) => c.name)).toEqual(['Toronto']);
  });

  test('a holder of only Manage roles reads the chapters but cannot change them', async ({
    page,
    api,
  }) => {
    api.chapters.add('Toronto');
    const ruth = api.addAccount({ email: 'ruth@example.org', capabilities: ['ManageRoles'] });
    const chapters = new OrganisationChaptersPage(page);
    await api.signInAs(ruth, '/organisation/chapters');

    await expect(chapters.readOnly).toBeVisible();
    await expect.poll(() => chapters.names('Cities')).toEqual(['Toronto']);
    await expect(chapters.add('City')).toHaveCount(0);
    await expect(chapters.moveUp('Toronto')).toHaveCount(0);
    await expect(chapters.rename('Toronto')).toHaveCount(0);
  });
});
