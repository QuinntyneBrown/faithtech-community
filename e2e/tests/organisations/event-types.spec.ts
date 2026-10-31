// Traces to: L2-145 AC1, AC2, AC3, AC4; L2-147 AC2; L2-152 AC1
// (docs/detailed-designs/organisations/taxonomies)
import { expect, test } from '../../fixtures/app';
import { EventFormPage } from '../../pages/event-form.page';
import { EventsPage } from '../../pages/events.page';
import { ArchiveListEntryDialog, ListEntryNameDialog } from '../../pages/list-entry.dialogs';
import { OrganisationTaxonomiesPage } from '../../pages/organisation-taxonomies.page';

const SETTINGS = {
  email: 'grace@example.org',
  capabilities: ['ManageOrganisationSettings' as const, 'ManageEvents' as const],
};

test.describe('Organisation settings: event types', () => {
  test('a settings manager sees the event types in order with their event counts', async ({
    page,
    api,
    axe,
  }) => {
    api.events.add({ title: 'Spring hackathon', type: 'hackathon' });
    api.events.add({ title: 'Autumn hackathon', type: 'hackathon' });
    api.events.add({ title: 'Panel on AI', type: 'panel' });
    const grace = api.addAccount(SETTINGS);
    const taxonomies = new OrganisationTaxonomiesPage(page);
    await api.signInAs(grace, '/organisation/taxonomies');

    await expect
      .poll(() => taxonomies.typeNames())
      .toEqual(['Gathering', 'Builders night', 'Hackathon', 'Prayer & planning', 'Panel']);
    await expect(taxonomies.typesCaption).toBeVisible();
    await expect(taxonomies.row('Gathering')).toContainText('0 events');
    await expect(taxonomies.row('Hackathon')).toContainText('2 events');
    await expect(taxonomies.row('Panel')).toContainText('1 event');
    await axe.check();
    await page.emulateMedia({ colorScheme: 'dark' });
    await axe.check();
  });

  test('a settings manager adds a type, which the event form offers at the end', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount(SETTINGS);
    const taxonomies = new OrganisationTaxonomiesPage(page);
    const form = new EventFormPage(page);
    await api.signInAs(grace, '/organisation/taxonomies');

    await taxonomies.addType.click();
    const add = new ListEntryNameDialog(page, 'Add an event type');
    await expect(add.name).toBeFocused();
    await add.name.fill('hackathon');
    await add.save.click();
    await expect(add.error('There’s already a type called hackathon.')).toBeVisible();
    await axe.check();
    await add.name.fill('Prayer walk');
    await add.save.click();

    await expect(add.dialog).toBeHidden();
    await expect(taxonomies.toast('Prayer walk added')).toContainText(
      'It’s the last type on the event form.',
    );
    await expect
      .poll(() => taxonomies.typeNames())
      .toEqual([
        'Gathering',
        'Builders night',
        'Hackathon',
        'Prayer & planning',
        'Panel',
        'Prayer walk',
      ]);
    expect(api.audit.at(-1)).toMatchObject({ action: 'taxonomy.updated', targetType: 'EventType' });

    await form.openNew();
    await expect(form.type.locator('option').last()).toHaveText('Prayer walk');
  });

  test('a rename shows on the events filter, and the order is saved', async ({ page, api }) => {
    const grace = api.addAccount(SETTINGS);
    const taxonomies = new OrganisationTaxonomiesPage(page);
    const events = new EventsPage(page);
    await api.signInAs(grace, '/organisation/taxonomies');

    await taxonomies.choose('Panel', 'Rename');
    const rename = new ListEntryNameDialog(page, 'Rename Panel');
    await expect(rename.name).toHaveValue('Panel');
    await rename.name.fill('Panel discussion');
    await rename.save.click();
    await expect(taxonomies.toast('Renamed to Panel discussion')).toContainText(
      'Its events and the event form show the new name.',
    );

    await taxonomies.moveDown('Gathering').click();
    await expect
      .poll(() => taxonomies.typeNames())
      .toEqual([
        'Builders night',
        'Gathering',
        'Hackathon',
        'Prayer & planning',
        'Panel discussion',
      ]);
    expect(api.callsTo('PUT', '/api/organisation/event-types/order').length).toBe(1);

    await events.open();
    await expect(events.type.locator('option')).toHaveText([
      'All types',
      'Builders night',
      'Gathering',
      'Hackathon',
      'Prayer & planning',
      'Panel discussion',
    ]);
  });

  test('an archived type keeps its events and is listed under Archived', async ({
    page,
    api,
    axe,
  }) => {
    api.events.add({ title: 'Panel on AI', type: 'panel' });
    api.events.add({ title: 'Panel on faith', type: 'panel' });
    const grace = api.addAccount(SETTINGS);
    const taxonomies = new OrganisationTaxonomiesPage(page);
    await api.signInAs(grace, '/organisation/taxonomies');

    await taxonomies.choose('Panel', 'Archive');
    const archive = new ArchiveListEntryDialog(page, 'Panel');
    await expect(archive.dialog).toContainText(
      'Events of type Panel keep it, but it leaves the event form and the type filter.',
    );
    await expect(archive.dialog).toContainText('2 events are of type Panel.');
    await axe.check();
    await archive.confirm.click();

    await expect(archive.dialog).toBeHidden();
    await expect(taxonomies.toast('Panel archived')).toContainText(
      'Its 2 events keep the type. It’s listed under Archived.',
    );
    await expect
      .poll(() => taxonomies.typeNames())
      .toEqual(['Gathering', 'Builders night', 'Hackathon', 'Prayer & planning']);
    await taxonomies.archived.click();
    await expect(taxonomies.archivedTypes).toContainText('Panel');
    await expect(taxonomies.archivedTypes).toContainText('2 events keep it');
    await axe.check();
  });

  test('the last active type cannot be archived', async ({ page, api }) => {
    for (const key of ['gathering', 'builders-night', 'hackathon', 'prayer-and-planning'])
      api.events.types.byKey(key)!.archivedAtUtc = api.now.toISOString();
    const grace = api.addAccount(SETTINGS);
    const taxonomies = new OrganisationTaxonomiesPage(page);
    await api.signInAs(grace, '/organisation/taxonomies');

    await taxonomies.choose('Panel', 'Archive');
    const archive = new ArchiveListEntryDialog(page, 'Panel');
    await archive.confirm.click();

    await expect(archive.refusal('Panel')).toContainText(
      'Keep at least one type. Add another type first.',
    );
    await archive.close.click();
    await expect.poll(() => taxonomies.typeNames()).toEqual(['Panel']);
  });

  test('a role manager sees the event types read-only', async ({ page, api, axe }) => {
    const marcus = api.addAccount({ email: 'marcus@example.org', capabilities: ['ManageRoles'] });
    const taxonomies = new OrganisationTaxonomiesPage(page);
    await api.signInAs(marcus, '/organisation/taxonomies');

    await expect(taxonomies.readOnly).toBeVisible();
    await expect.poll(() => taxonomies.typeNames()).toHaveLength(5);
    await expect(taxonomies.addType).toHaveCount(0);
    await expect(taxonomies.menu('Panel')).toHaveCount(0);
    await axe.check();
  });
});
