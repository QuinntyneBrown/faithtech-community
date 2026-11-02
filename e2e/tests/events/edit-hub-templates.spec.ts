// Traces to: L2-184 AC1 to AC5, L2-185 AC1 to AC5, AC7, L2-186 AC1 to AC4, L2-187 AC1 to AC3
// (docs/detailed-designs/events/edit-hub-templates)
import { Page } from '@playwright/test';

import { expect, test } from '../../fixtures/app';
import { MockApi } from '../../fixtures/mock-api';
import { CreateEventHubDialog } from '../../pages/create-event-hub.dialog';
import { EventPage } from '../../pages/event.page';
import { HubSectionDialog } from '../../pages/hub-section.dialog';
import {
  ArchiveHubTemplateDialog,
  HubTemplateNameDialog,
  HubTemplateSectionsDialog,
} from '../../pages/hub-template.dialogs';
import { HubTemplatePage, HubTemplatesPage } from '../../pages/hub-templates.page';
import { BREAKPOINTS, hasHorizontalScroll } from '../../pages/viewport';

test.use({ timezoneId: 'America/Toronto' });

const SETTINGS = {
  email: 'priya@example.org',
  name: 'Priya Shah',
  roles: ['SystemAdmin' as const],
};

async function signInAsAdmin(api: MockApi, path = '/organisation/hub-templates') {
  await api.signInAs(api.addAccount(SETTINGS), path);
}

test.describe('Edit hub templates: the list', () => {
  // L2-184 AC1: a fifth settings tab lists the templates in order with their counts.
  test('an administrator sees the organisation’s templates in order', async ({
    page,
    api,
    axe,
  }) => {
    const templates = new HubTemplatesPage(page);
    await signInAsAdmin(api, '/organisation');

    await templates.tab.click();

    await expect(page).toHaveURL(/\/organisation\/hub-templates$/);
    await expect(templates.heading).toBeVisible();
    await expect(templates.caption).toBeVisible();
    await expect.poll(() => templates.names()).toEqual(['Hackathon', 'Meetup', 'Workshop']);
    await expect(templates.row('Hackathon')).toContainText('17 sections shown · No hubs yet');
    await expect(templates.row('Meetup')).toContainText('6 sections shown');
    await expect(templates.row('Meetup')).toContainText('An evening of talks and conversation.');
    await axe.check();
    await page.emulateMedia({ colorScheme: 'dark' });
    await axe.check();
  });

  // L2-184 AC2: ManageRoles alone reads, without any action.
  test('a member who only manages roles sees the templates read-only', async ({ page, api }) => {
    const templates = new HubTemplatesPage(page);
    const template = new HubTemplatePage(page);
    const marcus = api.addAccount({ email: 'marcus@example.org', capabilities: ['ManageRoles'] });
    await api.signInAs(marcus, '/organisation/hub-templates');

    await expect(templates.readOnly).toBeVisible();
    await expect.poll(() => templates.names()).toEqual(['Hackathon', 'Meetup', 'Workshop']);
    await expect(templates.add).toBeHidden();
    await expect(templates.menu('Hackathon')).toBeHidden();

    await templates.link('Hackathon').click();
    await expect(template.heading('Hackathon')).toBeVisible();
    await expect(template.readOnly).toBeVisible();
    await expect(template.chooseSections).toBeHidden();
    await expect(template.editDefault('Process')).toBeHidden();
  });

  // L2-184 AC4: a provisioned organisation has none; a failed load offers Try again.
  test('an organisation without templates is told how to add one, and a failed load retries', async ({
    page,
    api,
    axe,
  }) => {
    api.events.hubs.templates = [];
    const templates = new HubTemplatesPage(page);
    await signInAsAdmin(api);

    await expect(templates.empty).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add a template' })).toHaveCount(2);
    await axe.check();

    api.events.hubs.templates = [];
    api.events.hubs.failNextTemplates();
    await templates.archived.click();
    await expect(templates.loadError).toBeVisible();
    await templates.tryAgain.click();
    await expect(templates.archivedEmpty).toBeVisible();
  });

  // L2-184 AC5: the tab fits a phone.
  test('the list and a template fit a phone', async ({ page, api, axe }) => {
    await page.setViewportSize(BREAKPOINTS.xs);
    const templates = new HubTemplatesPage(page);
    const template = new HubTemplatePage(page);
    await signInAsAdmin(api);

    await expect.poll(() => templates.names()).toEqual(['Hackathon', 'Meetup', 'Workshop']);
    expect(await hasHorizontalScroll(page)).toBe(false);
    await templates.link('Hackathon').click();
    await expect(template.row('Process')).toBeVisible();
    expect(await hasHorizontalScroll(page)).toBe(false);
    await axe.check();
  });
});

test.describe('Edit hub templates: add, rename, archive and restore', () => {
  // L2-185 AC1, AC3: add, with the name rules on the dialog.
  test('an administrator adds a template, which the wizard offers last', async ({
    page,
    api,
    axe,
  }) => {
    const templates = new HubTemplatesPage(page);
    await signInAsAdmin(api);

    await templates.add.click();
    const add = new HubTemplateNameDialog(page, 'Add a hub template');
    await expect(add.name).toBeFocused();
    await add.save.click();
    await expect(add.error('Enter a name.')).toBeVisible();
    await add.name.fill('meetup');
    await add.save.click();
    await expect(add.error('There’s already a template called meetup.')).toBeVisible();
    await axe.check();
    await add.name.fill('Retreat');
    await add.description.fill('A weekend away to rest, pray and plan.');
    await add.save.click();

    await expect(add.dialog).toBeHidden();
    await expect(templates.toast('Retreat added')).toBeVisible();
    await expect
      .poll(() => templates.names())
      .toEqual(['Hackathon', 'Meetup', 'Workshop', 'Retreat']);
    await expect(templates.row('Retreat')).toContainText('7 sections shown · No hubs yet');
    expect(api.audit.at(-1)).toMatchObject({ action: 'hub_template.updated' });
  });

  // L2-185 AC2, AC7: rename, with Try again after a failure.
  test('an administrator renames a template, retrying after a failed save', async ({
    page,
    api,
  }) => {
    const templates = new HubTemplatesPage(page);
    await signInAsAdmin(api);

    await templates.choose('Meetup', 'Rename');
    const rename = new HubTemplateNameDialog(page, 'Rename Meetup');
    await expect(rename.name).toHaveValue('Meetup');
    await rename.name.fill('Builders night');
    api.events.hubs.failNextTemplateSave();
    await rename.save.click();
    await expect(rename.failed).toBeVisible();
    await expect(rename.name).toHaveValue('Builders night');
    await rename.save.click();

    await expect(rename.dialog).toBeHidden();
    await expect(templates.toast('Renamed to Builders night')).toBeVisible();
    await expect.poll(() => templates.names()).toEqual(['Hackathon', 'Builders night', 'Workshop']);
  });

  // L2-185 AC4, AC5: archive leaves the list; restore puts it back last.
  test('an administrator archives a template and restores it', async ({ page, api, axe }) => {
    const templates = new HubTemplatesPage(page);
    await signInAsAdmin(api);

    await templates.choose('Hackathon', 'Archive');
    const archive = new ArchiveHubTemplateDialog(page, 'Hackathon');
    await expect(archive.dialog).toContainText(
      'Leads won’t be offered Hackathon when they create a hub.',
    );
    await axe.check();
    await archive.confirm.click();

    await expect(archive.dialog).toBeHidden();
    await expect(templates.toast('Hackathon archived')).toBeVisible();
    await expect.poll(() => templates.names()).toEqual(['Meetup', 'Workshop']);

    await templates.archived.click();
    await expect(templates.archivedList).toContainText('Hackathon');
    await templates.restore('Hackathon').click();
    await expect(templates.toast('Hackathon restored')).toBeVisible();
    await templates.active.click();
    await expect.poll(() => templates.names()).toEqual(['Meetup', 'Workshop', 'Hackathon']);
  });
});

/** Toronto Hackathon on Sat 21 Nov 2026 from 9:00 am; the signed-in administrator starts its hub from Hackathon. */
async function startHubFromHackathon(api: MockApi, page: Page) {
  const event = api.events.add({
    title: 'Toronto Hackathon',
    startsAt: '2026-11-21T14:00:00.000Z',
    endsAt: '2026-11-22T00:00:00.000Z',
  });
  await page.goto(`/events/${event.id}`);
  const wizard = new CreateEventHubDialog(page);
  await new EventPage(page).createEventHub.click();
  await wizard.next.click();
  await wizard.startingPoint('Hackathon').check();
  await wizard.next.click();
  return { event, wizard };
}

test.describe('Edit hub templates: sections and default text', () => {
  // L2-186 AC1: every section in catalogue order, with what new hubs get.
  test('a template lists its sections with their defaults', async ({ page, api, axe }) => {
    const templates = new HubTemplatesPage(page);
    const template = new HubTemplatePage(page);
    await signInAsAdmin(api);

    await templates.link('Hackathon').click();

    await expect(template.heading('Hackathon')).toBeVisible();
    await expect.poll(() => template.sectionTitles()).toHaveLength(17);
    await expect(template.row('Process')).toContainText('Default: The Create Cycle · 4 stages');
    await expect(template.row('Agenda')).toContainText('Default: 10 rows, 9:00 am to 6:00 pm');
    await expect(template.row('Tracks')).toContainText('No default text yet');
    await expect(template.row('People')).toContainText('Filled in on each hub, from your members.');
    await expect(template.row('Process')).toContainText('Shown');
    await expect(template.editDefault('People')).toHaveCount(0);
    await axe.check();
  });

  // L2-186 AC2, L2-187 AC1: unticked sections are hidden on new hubs.
  test('choosing sections changes what new hubs show', async ({ page, api, axe }) => {
    const templates = new HubTemplatesPage(page);
    const template = new HubTemplatePage(page);
    await signInAsAdmin(api);
    await templates.link('Hackathon').click();

    await template.chooseSections.click();
    const sections = new HubTemplateSectionsDialog(page);
    await expect(sections.section('Worship')).toBeChecked();
    await axe.check();
    await sections.section('Worship').uncheck();
    await sections.section('Slides').uncheck();
    await sections.save.click();

    await expect(sections.dialog).toBeHidden();
    await expect(template.toast('Sections saved')).toBeVisible();
    await expect(template.row('Worship')).toContainText('Hidden');

    const { wizard } = await startHubFromHackathon(api, page);
    await expect(wizard.section('Worship')).not.toBeChecked();
    await expect(wizard.section('Slides')).not.toBeChecked();
    await expect(wizard.section('Process')).toBeChecked();
  });

  // L2-186 AC2: nothing ticked is refused on the dialog.
  test('a template must show at least one section', async ({ page, api }) => {
    const template = new HubTemplatePage(page);
    const id = api.events.hubs.templates[2].id;
    await signInAsAdmin(api, `/organisation/hub-templates/${id}`);

    await template.chooseSections.click();
    const sections = new HubTemplateSectionsDialog(page);
    for (const title of ['Hero', 'Agenda', 'Venue', 'People', 'Upcoming events'])
      await sections.section(title).uncheck();
    await sections.save.click();

    await expect(sections.error('Tick at least one section.')).toBeVisible();
  });

  // L2-186 AC3, L2-187 AC1, AC2: the hub's wizard edits a default; new hubs use it and earlier ones keep theirs.
  test('editing a default with the hub’s wizard changes new hubs only', async ({
    page,
    api,
    axe,
  }) => {
    const template = new HubTemplatePage(page);
    const id = api.events.hubs.templates[0].id;
    await signInAsAdmin(api, `/organisation/hub-templates/${id}`);

    await template.editDefault('Hero').click();
    const hero = new HubSectionDialog(page, 'Hero');
    await expect(
      hero.text(
        'You’re editing the default for new hubs started from Hackathon. Hubs already started keep what they have.',
      ),
    ).toBeVisible();
    await expect(hero.preview).toHaveCount(0);
    await expect(hero.field('Subtitle')).toHaveValue(
      'One day to build for the church. Form a team and ship something real.',
    );
    await axe.check();
    await hero.field('Subtitle').fill('Build something real for the church, together.');
    await hero.save.click();

    await expect(hero.dialog).toBeHidden();
    await expect(template.toast('Hero saved')).toContainText(
      'New hubs started from Hackathon will use it.',
    );
    await expect(template.row('Hero')).toContainText(
      'Default: “Build something real for the church, together.”',
    );

    const { event, wizard } = await startHubFromHackathon(api, page);
    await wizard.next.click();
    await wizard.saveLater.click();
    expect(api.events.hubs.section(event.id, 'Hero')?.content).toMatchObject({
      subtitle: 'Build something real for the church, together.',
    });
  });

  // L2-186 AC4: the Agenda is shown for a 9:00 am start and saved in minutes.
  test('the agenda default is edited against a 9:00 am start', async ({ page, api }) => {
    const template = new HubTemplatePage(page);
    const id = api.events.hubs.templates[1].id;
    await signInAsAdmin(api, `/organisation/hub-templates/${id}`);

    await template.editDefault('Agenda').click();
    const agenda = new HubSectionDialog(page, 'Agenda');
    await expect(
      agenda.text(
        'Times are shown for an event that starts at 9:00 am. A new hub moves every row to its own event’s start, so 9:30 am becomes half an hour in.',
      ),
    ).toBeVisible();
    await expect(agenda.dialog).toContainText('Doors open');
    await expect(agenda.dialog).toContainText('9:30');
    await agenda.next.click();
    await agenda.save.click();

    await expect(agenda.dialog).toBeHidden();
    const rows = api.events.hubs.templates[1].sections.find((s) => s.kind === 'Agenda')?.content;
    expect(rows).toMatchObject({
      items: [
        { minutes: 0, title: 'Doors open' },
        { minutes: 30, title: 'Welcome and prayer' },
        { minutes: 45, title: 'Talks' },
        { minutes: 90, title: 'Conversation and connection' },
      ],
    });
  });

  // L2-184 AC4: an unknown template.
  test('an unknown template says so', async ({ page, api }) => {
    const template = new HubTemplatePage(page);
    await signInAsAdmin(api, '/organisation/hub-templates/no-such-template');

    await expect(template.notFound).toBeVisible();
    await expect(template.back).toBeVisible();
  });
});
