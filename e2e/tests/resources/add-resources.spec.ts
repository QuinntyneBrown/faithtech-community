// Traces to: L2-057, L2-058, L2-059, L2-066 (docs/detailed-designs/resources/add-and-edit)
import { expect, test } from '../../fixtures/app';
import { AddResourceDialog } from '../../pages/resource.dialogs';
import { ResourcePage } from '../../pages/resource.page';
import { ResourcesPage } from '../../pages/resources.page';

const pdf = (name: string) => ({ name, buffer: Buffer.from('%PDF-1.7 test') });

test.describe('Add resources', () => {
  test('a lead uploads one file: title from its name, type from its extension, Global by default', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({
      email: 'grace@example.org',
      name: 'Grace Okonkwo',
      roles: ['CityLead'],
    });
    await api.signInAs(grace, '/resources');
    const resources = new ResourcesPage(page);
    await resources.add.click();
    const dialog = new AddResourceDialog(page);
    await dialog.opened();
    await expect(dialog.dialog).toContainText('Up to 20 files, 100 MB each.');
    await expect(dialog.visibility('Global')).toBeChecked();
    await expect(dialog.submit('Add resource')).toBeDisabled();
    await axe.check();

    await dialog.choose({ name: 'city-launch-deck.pptx', buffer: Buffer.from('PK deck') });
    await expect(dialog.file('city-launch-deck.pptx')).toContainText('PPTX · 1 KB');
    await expect(dialog.title).toHaveValue('city-launch-deck');
    await expect(dialog.type).toHaveValue('deck');
    await expect(dialog.dialog).toContainText('Guessed from .pptx — change it if it’s wrong.');
    await dialog.title.fill('City launch deck');
    await dialog.addTag('Launch');
    await axe.check();
    await dialog.submit('Add resource').click();

    await expect(dialog.dialog).toBeHidden();
    await expect(resources.toast).toContainText('City launch deck added');
    await expect(resources.toast).toContainText('Every signed-in member can find it now.');
    await expect(resources.item('City launch deck')).toContainText('Deck · PPTX · 1 KB · you');
    expect(api.resources.resources[0]).toMatchObject({
      tags: ['launch'],
      visibility: 'Global',
      fileName: 'city-launch-deck.pptx',
    });
  });

  test('a batch makes one resource per file with the shared tags and visibility', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    await api.signInAs(grace, '/resources');
    const resources = new ResourcesPage(page);
    await resources.add.click();
    const dialog = new AddResourceDialog(page);

    await dialog.choose(
      pdf('brand-colours.pdf'),
      { name: 'faithtech-mark.svg', buffer: Buffer.from('<svg/>') },
      pdf('logo-rules.pdf'),
    );
    await expect(dialog.dialog).toContainText('3 files');
    await expect(dialog.dialog).toContainText('Each file becomes its own resource');
    await expect(dialog.title).toHaveCount(0);
    await dialog.addTag('brand');
    await dialog.visibility('Private').check();
    await axe.check();
    await dialog.submit('Add 3 resources').click();

    await expect(resources.toast).toContainText('3 resources added');
    await expect(resources.items).toHaveCount(3);
    expect(api.resources.resources.map((r) => [r.title, r.type, r.visibility, r.tags])).toEqual([
      ['brand-colours', 'document', 'Private', ['brand']],
      ['faithtech-mark', 'logo', 'Private', ['brand']],
      ['logo-rules', 'document', 'Private', ['brand']],
    ]);
  });

  test('a file of another type is refused with the allowed types until it is removed', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    await api.signInAs(grace, '/resources');
    await new ResourcesPage(page).add.click();
    const dialog = new AddResourceDialog(page);

    await dialog.choose(pdf('run-sheet.pdf'), {
      name: 'raw-footage.mov',
      buffer: Buffer.from('mov'),
    });
    const refused = dialog.file('raw-footage.mov');
    await expect(refused).toContainText('Can’t add');
    await expect(refused).toContainText(
      'raw-footage.mov can’t be added. Use PPTX, PPT, KEY, PDF, DOCX, DOC, XLSX, CSV, PNG, JPG, SVG, GIF, WEBP, MP4 or ZIP, up to 100 MB. For longer video, add a link instead.',
    );
    await expect(dialog.submit('Add 2 resources')).toBeDisabled();
    await axe.check();

    await refused.getByRole('button', { name: 'Remove raw-footage.mov' }).click();
    await expect(dialog.submit('Add resource')).toBeEnabled();
  });

  test('an empty title is refused with the error summary', async ({ page, api, axe }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    await api.signInAs(grace, '/resources');
    await new ResourcesPage(page).add.click();
    const dialog = new AddResourceDialog(page);

    await dialog.choose(pdf('run-sheet.pdf'));
    await dialog.title.fill('  ');
    await dialog.submit('Add resource').click();

    await expect(dialog.errorSummary).toContainText('Fix 1 thing to add this');
    await expect(dialog.dialog).toContainText('Give it a title so people can find it.');
    await axe.check();
    expect(api.resources.resources).toHaveLength(0);
  });

  test('files that lose the connection can be tried again without re-adding the others', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    await api.signInAs(grace, '/resources');
    const resources = new ResourcesPage(page);
    await resources.add.click();
    const dialog = new AddResourceDialog(page);
    await dialog.choose(pdf('one.pdf'), pdf('two.pdf'));
    api.resources.dropOnce.add('two.pdf');

    await dialog.submit('Add 2 resources').click();
    await expect(dialog.alert).toContainText('1 file didn’t upload');
    await expect(dialog.alert).toContainText('The other 1 were added.');
    await expect(dialog.file('two.pdf')).toContainText('Didn’t upload');
    await expect(dialog.file('one.pdf')).toContainText('100% · Uploaded');
    await axe.check();

    await dialog.submit('Try 1 again').click();
    await expect(dialog.dialog).toBeHidden();
    await expect(resources.toast).toContainText('2 resources added');
    expect(api.resources.resources.map((r) => r.title)).toEqual(['one', 'two']);
  });

  test('a lead adds one https link, never anything else', async ({ page, api, axe }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['EventLead'] });
    await api.signInAs(grace, '/resources');
    const resources = new ResourcesPage(page);
    await resources.add.click();
    const dialog = new AddResourceDialog(page);
    await dialog.linkTab.click();
    await expect(dialog.dialog).toContainText('Must start with https://.');

    await dialog.link.fill('http://www.canva.com/design/1');
    await dialog.title.fill('Event poster template');
    await dialog.type.selectOption('Template');
    await dialog.submit('Add link').click();
    await expect(dialog.dialog).toContainText('Use a link that starts with https://.');
    await axe.check();

    await dialog.link.fill('https://www.canva.com/design/1');
    await dialog.submit('Add link').click();
    await expect(resources.toast).toContainText('Event poster template added');
    await expect(resources.item('Event poster template')).toContainText(
      'Template · canva.com · you',
    );
  });

  test('Staff add resources, the one write outside private contacts', async ({ page, api }) => {
    const esther = api.addAccount({ email: 'esther@example.org', roles: ['Staff'] });
    await api.signInAs(esther, '/resources');
    const resources = new ResourcesPage(page);
    await resources.add.click();
    const dialog = new AddResourceDialog(page);

    await dialog.choose(pdf('staff-handbook.pdf'));
    await dialog.submit('Add resource').click();

    await expect(resources.item('staff-handbook')).toBeVisible();
  });

  test('a lead whose email is not verified is told to verify first', async ({ page, api }) => {
    const grace = api.addAccount({
      email: 'grace@example.org',
      roles: ['CityLead'],
      verified: false,
    });
    await api.signInAs(grace, '/resources');
    await new ResourcesPage(page).add.click();
    const dialog = new AddResourceDialog(page);

    await dialog.choose(pdf('run-sheet.pdf'));
    await dialog.submit('Add resource').click();

    await expect(dialog.alert).toContainText('Verify your email before adding resources.');
    expect(api.resources.resources).toHaveLength(0);
  });

  test('an added resource opens from its toast', async ({ page, api }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    await api.signInAs(grace, '/resources');
    const resources = new ResourcesPage(page);
    await resources.add.click();
    const dialog = new AddResourceDialog(page);
    await dialog.choose(pdf('run-sheet.pdf'));
    await dialog.submit('Add resource').click();

    await resources.toast.getByRole('button', { name: 'View' }).click();

    await expect(new ResourcePage(page).heading).toHaveText('run-sheet');
  });
});
