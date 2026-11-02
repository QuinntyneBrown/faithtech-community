import { expect, test } from '../../../e2e/fixtures/app';
import { EventHubPage } from '../../../e2e/pages/event-hub.page';
import { HubResourcePickerDialog } from '../../../e2e/pages/hub-resource-picker.dialog';
import { HubSectionDialog } from '../../../e2e/pages/hub-section.dialog';
import { HubPage } from '../../../e2e/pages/hub.page';
import { Presenter } from '../presenter';

test.use({ timezoneId: 'America/Los_Angeles' });

const OPTIONAL = [
  'Parking',
  'WhatToBring',
  'Partners',
  'Tracks',
  'Process',
  'Rules',
  'DemoFormat',
  'Judging',
  'Worship',
  'Slides',
] as const;

// Journey: build a hackathon hub (docs/detailed-designs/events/build-hackathon-hub, L2-172 to L2-183).
test('build-hackathon-hub', async ({ page, api }) => {
  const show = await Presenter.start(page, 'build-hackathon-hub');
  const home = new EventHubPage(page);
  const visitor = new HubPage(page);
  const picker = new HubResourcePickerDialog(page);
  const socal = api.events.add({
    title: 'SoCal Hackathon',
    startsAt: '2026-10-24T16:00:00.000Z',
    endsAt: '2026-10-25T01:00:00.000Z',
    venue: 'The Robertson Triangle, 3390 Robertson Pl, Los Angeles',
    visibility: 'Public',
  });
  const grace = api.addAccount({
    email: 'grace@example.org',
    name: 'Grace Okonkwo',
    roles: ['CityLead'],
  });
  api.resources.add({
    title: 'SoCal parking, on site',
    ownerId: grace.profileId,
    fileName: 'parking-on-site.jpg',
  });
  const welcome = api.resources.add({
    title: 'SoCal welcome slide',
    ownerId: grace.profileId,
    fileName: 'welcome.jpg',
  });
  const tracks = api.resources.add({
    title: 'SoCal tracks slide',
    ownerId: grace.profileId,
    fileName: 'tracks.png',
  });
  api.events.hubs.add(socal, [], [...OPTIONAL]);
  api.events.hubs.fill(socal.id, 'Slides', {
    slides: [{ resourceId: welcome.id }, { resourceId: tracks.id }],
  });

  await show.card(
    'opening',
    'opening',
    ['Build a hackathon hub', 'Recorded against a local fake API · synthetic people and events'],
    () => api.signInAs(grace, `/events/${socal.id}/hub`),
  );

  await show.step(
    'sections',
    async () => {
      await expect(home.heading).toHaveText('Event hub');
      await page.mouse.wheel(0, 600);
    },
    { poster: true },
  );

  const rules = new HubSectionDialog(page, 'Rules');
  await show.step('rules', async () => {
    await page.mouse.wheel(0, -600);
    await home.openWizard('Rules');
    await rules.button('Add a rule').click();
    await rules.rowField('Rule 01', 'Title').pressSequentially('Any stack', { delay: 60 });
    await rules.button('Add a rule').click();
    await rules.rowField('Rule 02', 'Title').pressSequentially('Start fresh', { delay: 60 });
  });

  await show.step('reorder', async () => {
    await rules.rowAction('Rule 02', 'up').click();
    await expect(rules.rowField('Rule 01', 'Title')).toHaveValue('Start fresh');
    await rules.save.click();
    await expect(home.toast('Rules saved')).toBeVisible();
  });

  const demo = new HubSectionDialog(page, 'Demo format');
  await show.step('demo', async () => {
    await home.openWizard('Demo format');
    await demo.number('Minutes per demo').fill('3');
    await demo.number('Minutes for questions').fill('2');
    await demo.button('Add a segment').click();
    await demo.rowField('Segment 01', 'Title').fill('Your track');
    await demo.rowField('Segment 01', 'Length in seconds').fill('120');
    await demo.button('Add a segment').click();
    await demo.rowField('Segment 02', 'Title').fill('Tend');
    await demo.rowField('Segment 02', 'Length in seconds').fill('90');
    await expect(demo.status('Segments: 3:30 of 3:00')).toBeVisible();
  });

  await show.step('fit', async () => {
    await demo.rowField('Segment 02', 'Length in seconds').fill('60');
    await expect(demo.status('Segments: 3:00 of 3:00')).toBeVisible();
    await demo.save.click();
    await expect(home.toast('Demo format saved')).toBeVisible();
  });

  const parking = new HubSectionDialog(page, 'Parking');
  await show.step('parking', async () => {
    await home.openWizard('Parking');
    await parking.field('Note').fill('Park on site first.');
    await parking.next.click();
    await parking.button('Add an option').click();
    await parking.rowField('Option 01', 'Name').fill('On site · 75 spots');
    await parking.row('Option 01').getByRole('button', { name: 'Choose from Resources' }).click();
    await expect(picker.option('SoCal parking, on site')).toBeVisible();
  });

  await show.step('map', async () => {
    await picker.option('SoCal parking, on site').check();
    await picker.choose.click();
    await expect(parking.row('Option 01').getByText('SoCal parking, on site')).toBeVisible();
    await parking.save.click();
    await expect(home.toast('Parking saved')).toBeVisible();
  });

  await show.step('page', async () => {
    api.events.hubs.publish(socal.id);
    await visitor.open(socal.id);
    await expect(visitor.region('Parking')).toBeVisible();
    await visitor.region('Parking').scrollIntoViewIfNeeded();
  });

  await show.step('slides', async () => {
    const slides = visitor.region('Slides');
    await slides.scrollIntoViewIfNeeded();
    await slides.getByRole('button', { name: 'Next slide' }).click();
    await expect(slides.getByRole('status')).toContainText('Slide 2 of 2');
  });

  await show.card('closing', 'closing', [
    'Ten hackathon sections, each optional',
    'Maps and slides come from Resources',
    'Partners read live, numbers checked as you type',
  ]);
  await show.finish();
});
