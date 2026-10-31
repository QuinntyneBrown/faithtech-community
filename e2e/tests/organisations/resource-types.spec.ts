// Traces to: L2-146 AC1, AC2, AC3, AC4; L2-147 AC2; L2-152 AC1
// (docs/detailed-designs/organisations/taxonomies)
import { expect, test } from '../../fixtures/app';
import { ArchiveListEntryDialog, ListEntryNameDialog } from '../../pages/list-entry.dialogs';
import { OrganisationTaxonomiesPage } from '../../pages/organisation-taxonomies.page';
import { AddResourceDialog, EditResourceDialog } from '../../pages/resource.dialogs';
import { ResourcePage } from '../../pages/resource.page';
import { ResourcesPage } from '../../pages/resources.page';

const SETTINGS = {
  email: 'grace@example.org',
  name: 'Grace Okonkwo',
  capabilities: ['ManageOrganisationSettings' as const, 'AddResources' as const],
};

test.describe('Organisation settings: resource types', () => {
  test('a settings manager sees the resource types in order with their resource counts', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount(SETTINGS);
    api.resources.add({ title: 'Poster', ownerId: grace.profileId, type: 'template' });
    api.resources.add({ title: 'Flyer', ownerId: grace.profileId, type: 'template' });
    api.resources.add({ title: 'Launch deck', ownerId: grace.profileId, type: 'deck' });
    const taxonomies = new OrganisationTaxonomiesPage(page);
    await api.signInAs(grace, '/organisation/taxonomies');

    await expect
      .poll(() => taxonomies.resourceTypeNames())
      .toEqual(['Deck', 'Logo', 'Image', 'Training', 'Template', 'Document', 'Other']);
    await expect(taxonomies.resourceTypesCaption).toBeVisible();
    await expect(taxonomies.row('Template')).toContainText('2 resources');
    await expect(taxonomies.row('Deck')).toContainText('1 resource');
    await expect(taxonomies.row('Other')).toContainText(
      'Used when no other type fits; it can’t be archived',
    );
    await axe.check();
    await page.emulateMedia({ colorScheme: 'dark' });
    await axe.check();
  });

  test('the type keyed other offers only Rename', async ({ page, api }) => {
    const grace = api.addAccount(SETTINGS);
    const taxonomies = new OrganisationTaxonomiesPage(page);
    await api.signInAs(grace, '/organisation/taxonomies');

    await taxonomies.menu('Other').click();
    await expect(taxonomies.menuItem('Rename')).toBeVisible();
    await expect(taxonomies.menuItem('Archive')).toHaveCount(0);
  });

  test('a settings manager adds a type, which the add dialog offers at the end', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount(SETTINGS);
    const taxonomies = new OrganisationTaxonomiesPage(page);
    await api.signInAs(grace, '/organisation/taxonomies');

    await taxonomies.addResourceType.click();
    const add = new ListEntryNameDialog(page, 'Add a resource type');
    await expect(add.name).toBeFocused();
    await add.name.fill('logo');
    await add.save.click();
    await expect(add.error('There’s already a type called logo.')).toBeVisible();
    await axe.check();
    await add.name.fill('Event poster');
    await add.save.click();

    await expect(add.dialog).toBeHidden();
    await expect(taxonomies.toast('Event poster added')).toContainText(
      'It’s the last type on the add and edit dialogs.',
    );
    await expect
      .poll(() => taxonomies.resourceTypeNames())
      .toEqual([
        'Deck',
        'Logo',
        'Image',
        'Training',
        'Template',
        'Document',
        'Other',
        'Event poster',
      ]);
    expect(api.audit.at(-1)).toMatchObject({
      action: 'taxonomy.updated',
      targetType: 'ResourceType',
    });

    const resources = new ResourcesPage(page);
    await resources.open();
    await resources.add.click();
    const dialog = new AddResourceDialog(page);
    await dialog.opened();
    await dialog.linkTab.click();
    await expect(dialog.type.locator('option').last()).toHaveText('Event poster');
  });

  test('a rename shows on the resources filter, and the order is saved', async ({ page, api }) => {
    const grace = api.addAccount(SETTINGS);
    const taxonomies = new OrganisationTaxonomiesPage(page);
    const resources = new ResourcesPage(page);
    await api.signInAs(grace, '/organisation/taxonomies');

    await taxonomies.choose('Deck', 'Rename');
    const rename = new ListEntryNameDialog(page, 'Rename Deck');
    await expect(rename.name).toHaveValue('Deck');
    await rename.name.fill('Slides');
    await rename.save.click();
    await expect(taxonomies.toast('Renamed to Slides')).toContainText(
      'Its resources and the dialogs show the new name.',
    );

    await taxonomies.moveDown('Slides').click();
    await expect
      .poll(() => taxonomies.resourceTypeNames())
      .toEqual(['Logo', 'Slides', 'Image', 'Training', 'Template', 'Document', 'Other']);
    expect(api.callsTo('PUT', '/api/organisation/resource-types/order').length).toBe(1);

    await resources.open();
    await expect(resources.type('Slides')).toBeVisible();
    await expect(resources.type('Deck')).toHaveCount(0);
  });

  test('an archived type keeps its resources, which Show archived types finds', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount(SETTINGS);
    const poster = api.resources.add({
      title: 'Poster',
      ownerId: grace.profileId,
      type: 'template',
    });
    api.resources.add({ title: 'Launch deck', ownerId: grace.profileId, type: 'deck' });
    const taxonomies = new OrganisationTaxonomiesPage(page);
    await api.signInAs(grace, '/organisation/taxonomies');

    await taxonomies.choose('Template', 'Archive');
    const archive = new ArchiveListEntryDialog(page, 'Template');
    await expect(archive.dialog).toContainText(
      'Resources of type Template keep it, but it leaves the add and edit dialogs and the type filter.',
    );
    await expect(archive.dialog).toContainText('1 resource is of type Template.');
    await axe.check();
    await archive.confirm.click();
    await expect(taxonomies.toast('Template archived')).toContainText(
      'Its 1 resource keeps the type. It’s listed under Archived.',
    );
    await taxonomies.archived.click();
    await expect(taxonomies.archivedResourceTypes).toContainText('Template');
    await expect(taxonomies.archivedResourceTypes).toContainText('1 resource keeps it');
    await axe.check();

    const resources = new ResourcesPage(page);
    await resources.open();
    await expect(resources.type('Template')).toHaveCount(0);
    await resources.type('Show archived types').click();
    await expect(resources.type('Show archived types')).toHaveAttribute('aria-pressed', 'true');
    await resources.type('Template').click();
    await expect.poll(() => resources.titles()).toEqual(['Poster']);
    await axe.check();

    const resource = new ResourcePage(page);
    await resource.open(poster.id);
    await expect(resource.subtitle).toContainText('Template');
    await resource.edit.click();
    const edit = new EditResourceDialog(page);
    await edit.opened();
    await expect(edit.type).toHaveValue('template');
    await expect(edit.type.locator('option:checked')).toHaveText('Template (archived)');
    await expect(edit.dialog).toContainText(
      'Template was archived. It stays on this resource until you choose another type.',
    );
    await axe.check();
  });

  test('an upload of an archived type’s extension gets Other', async ({ page, api }) => {
    const grace = api.addAccount(SETTINGS);
    api.resources.types.byKey('deck')!.archivedAtUtc = api.now.toISOString();
    await api.signInAs(grace, '/resources');
    const resources = new ResourcesPage(page);
    await resources.add.click();
    const dialog = new AddResourceDialog(page);
    await dialog.opened();

    await dialog.choose({ name: 'city-launch-deck.pptx', buffer: Buffer.from('PK deck') });

    await expect(dialog.type).toHaveValue('other');
  });

  test('a role manager sees the resource types read-only', async ({ page, api, axe }) => {
    const marcus = api.addAccount({ email: 'marcus@example.org', capabilities: ['ManageRoles'] });
    const taxonomies = new OrganisationTaxonomiesPage(page);
    await api.signInAs(marcus, '/organisation/taxonomies');

    await expect(taxonomies.readOnly).toBeVisible();
    await expect.poll(() => taxonomies.resourceTypeNames()).toHaveLength(7);
    await expect(taxonomies.addResourceType).toHaveCount(0);
    await expect(taxonomies.menu('Deck')).toHaveCount(0);
    await axe.check();
  });
});
