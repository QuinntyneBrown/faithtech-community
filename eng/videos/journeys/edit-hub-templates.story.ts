import { expect, test } from '../../../e2e/fixtures/app';
import { CreateEventHubDialog } from '../../../e2e/pages/create-event-hub.dialog';
import { EventPage } from '../../../e2e/pages/event.page';
import { HubSectionDialog } from '../../../e2e/pages/hub-section.dialog';
import {
  HubTemplateNameDialog,
  HubTemplateSectionsDialog,
} from '../../../e2e/pages/hub-template.dialogs';
import { HubTemplatePage, HubTemplatesPage } from '../../../e2e/pages/hub-templates.page';
import { Presenter } from '../presenter';

test.use({ timezoneId: 'America/Toronto' });

// Journey: edit hub templates (docs/detailed-designs/events/edit-hub-templates, L2-184 to L2-187).
test('edit-hub-templates', async ({ page, api }) => {
  const show = await Presenter.start(page, 'edit-hub-templates');
  const templates = new HubTemplatesPage(page);
  const template = new HubTemplatePage(page);
  const night = api.events.add({
    title: 'Toronto Prayer Night',
    startsAt: '2026-11-20T00:00:00.000Z',
    endsAt: '2026-11-20T02:30:00.000Z',
    visibility: 'Public',
  });
  const priya = api.addAccount({
    email: 'priya@example.org',
    name: 'Priya Shah',
    roles: ['SystemAdmin'],
  });

  await show.card(
    'opening',
    'opening',
    ['Edit hub templates', 'Recorded against a local fake API · synthetic people and events'],
    () => api.signInAs(priya, '/organisation'),
  );

  await show.step(
    'tab',
    async () => {
      await templates.tab.click();
      await expect.poll(() => templates.names()).toEqual(['Hackathon', 'Meetup', 'Workshop']);
    },
    { poster: true },
  );

  await show.step('add', async () => {
    await templates.add.click();
    const add = new HubTemplateNameDialog(page, 'Add a hub template');
    await add.name.pressSequentially('Prayer night', { delay: 80 });
    await add.description.pressSequentially('An evening of worship and prayer for the city.', {
      delay: 30,
    });
    await add.save.click();
    await expect(templates.toast('Prayer night added')).toBeVisible();
  });

  await show.step('open', async () => {
    await templates.link('Prayer night').click();
    await expect(template.row('Hero')).toContainText('No default text yet');
  });

  await show.step('sections', async () => {
    await template.chooseSections.click();
    const sections = new HubTemplateSectionsDialog(page);
    await sections.section('Worship').check();
    await sections.section('Submission and feedback').uncheck();
    await sections.save.click();
    await expect(template.toast('Sections saved')).toBeVisible();
  });

  await show.step('default', async () => {
    await template.editDefault('Hero').click();
    const hero = new HubSectionDialog(page, 'Hero');
    await hero.field('Subtitle').pressSequentially('Come and pray for our city.', { delay: 60 });
  });

  await show.step('saved', async () => {
    const hero = new HubSectionDialog(page, 'Hero');
    await hero.save.click();
    await expect(template.toast('Hero saved')).toBeVisible();
  });

  await show.step('offered', async () => {
    const wizard = new CreateEventHubDialog(page);
    const eventPage = new EventPage(page);
    await eventPage.open(night.id);
    await eventPage.createEventHub.click();
    await wizard.next.click();
    await expect(wizard.startingPoint('Prayer night')).toBeVisible();
    await wizard.startingPoint('Prayer night').check();
    await wizard.next.click();
    await expect(wizard.section('Worship')).toBeChecked();
  });

  await show.card('closing', 'closing', [
    'Templates live in Organisation settings',
    'The hub wizards write their text',
    'Changes reach new hubs only',
  ]);
  await show.finish();
});
