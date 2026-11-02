// Traces to: L2-172 AC3, L2-173 AC1, L2-174 AC1, L2-175 AC1, L2-176 AC1, L2-177 AC1, L2-178 AC1, L2-179 AC1, AC2,
// L2-180 AC1, AC2, L2-181 AC1, L2-182 AC1 (docs/detailed-designs/events/build-hackathon-hub)
import { expect, test } from '../../fixtures/app';
import { MockApi } from '../../fixtures/mock-api';
import { EventHubPage } from '../../pages/event-hub.page';
import { HubResourcePickerDialog } from '../../pages/hub-resource-picker.dialog';
import { HubSectionDialog } from '../../pages/hub-section.dialog';

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

/** SoCal Hackathon with a hub holding every section, and its City Lead on the hub home. */
async function arrange(api: MockApi) {
  const event = api.events.add({
    title: 'SoCal Hackathon',
    startsAt: '2026-10-24T16:00:00.000Z',
    endsAt: '2026-10-25T01:00:00.000Z',
    visibility: 'Public',
  });
  api.events.hubs.add(event, [], [...OPTIONAL]);
  const grace = api.addAccount({
    email: 'grace@example.org',
    name: 'Grace Okonkwo',
    roles: ['CityLead'],
  });
  await api.signInAs(grace, `/events/${event.id}/hub`);
  return { event, grace };
}

test.describe('Hub sections: hackathon wizards', () => {
  // L2-178 AC1, L2-172 AC3: rules in order, reordered with the arrows; a rule needs a title.
  test('a lead adds rules, reorders them and saves', async ({ page, api, axe }) => {
    const { event } = await arrange(api);
    const hub = new EventHubPage(page);
    const wizard = new HubSectionDialog(page, 'Rules');

    await hub.openWizard('Rules');
    await expect(wizard.question).toHaveText('What rules do teams build by?');
    await expect(wizard.text('No rules yet.')).toBeVisible();
    await wizard.button('Add a rule').click();
    await wizard.save.click();
    await expect(wizard.text('Name this rule.')).toBeVisible();

    await wizard.rowField('Rule 01', 'Title').fill('Any stack');
    await wizard.button('Add a rule').click();
    await wizard.rowField('Rule 02', 'Title').fill('Start fresh');
    await wizard.rowField('Rule 02', 'Detail').fill('The code starts today.');
    await wizard.rowAction('Rule 02', 'up').click();
    await expect(wizard.rowField('Rule 01', 'Title')).toHaveValue('Start fresh');
    await axe.check();
    await wizard.save.click();

    await expect(hub.toast('Rules saved')).toBeVisible();
    expect(await hub.summary()).toContain('Rules: Ready');
    expect(api.events.hubs.section(event.id, 'Rules')?.content).toEqual({
      rules: [
        { title: 'Start fresh', detail: 'The code starts today.' },
        { title: 'Any stack', detail: null },
      ],
      note: null,
    });
  });

  // L2-174 AC1: what to bring, then what to expect on the day.
  test('a lead fills in What to bring over two steps', async ({ page, api, axe }) => {
    const { event } = await arrange(api);
    const hub = new EventHubPage(page);
    const wizard = new HubSectionDialog(page, 'What to bring');

    await hub.openWizard('What to bring');
    await expect(wizard.question).toHaveText('What should people bring?');
    await wizard.button('Add an item').click();
    await wizard.field('Item 1').fill('Your laptop and charger');
    await axe.check();
    await wizard.next.click();

    await expect(wizard.question).toHaveText('What should people expect on the day?');
    await wizard.button('Add a line').click();
    await wizard.rowField('Line 01', 'Title').fill('Raise a hand');
    await wizard.rowField('Line 01', 'Detail').fill('Mentors walk the floor every hour.');
    await wizard.save.click();

    await expect(hub.toast('What to bring saved')).toBeVisible();
    expect(api.events.hubs.section(event.id, 'WhatToBring')?.content).toEqual({
      bring: ['Your laptop and charger'],
      onTheDay: [{ title: 'Raise a hand', detail: 'Mentors walk the floor every hour.' }],
    });
  });

  // L2-179 AC1, AC2: the segments' running total, and the refusal when they run over.
  test('a lead fits the demo segments into the demo’s minutes', async ({ page, api, axe }) => {
    const { event } = await arrange(api);
    const hub = new EventHubPage(page);
    const wizard = new HubSectionDialog(page, 'Demo format');

    await hub.openWizard('Demo format');
    await expect(wizard.question).toHaveText('How do demos run?');
    await wizard.number('Minutes per demo').fill('3');
    await wizard.number('Minutes for questions').fill('2');
    await wizard.button('Add a segment').click();
    await wizard.rowField('Segment 01', 'Title').fill('Your track');
    await wizard.rowField('Segment 01', 'Length in seconds').fill('120');
    await wizard.button('Add a segment').click();
    await wizard.rowField('Segment 02', 'Title').fill('Tend');
    await wizard.rowField('Segment 02', 'Length in seconds').fill('90');
    await expect(wizard.status('Segments: 3:30 of 3:00')).toBeVisible();
    await wizard.save.click();
    await expect(wizard.text('The segments run 3:30. Make them fit in 3 minutes.')).toBeVisible();
    await axe.check();

    await wizard.rowField('Segment 02', 'Length in seconds').fill('60');
    await expect(wizard.status('Segments: 3:00 of 3:00')).toBeVisible();
    await wizard.button('Add a tip').click();
    await wizard.field('Tip 1').fill('Demo on a phone');
    await wizard.save.click();

    await expect(hub.toast('Demo format saved')).toBeVisible();
    expect(api.events.hubs.section(event.id, 'DemoFormat')?.content).toEqual({
      minutes: 3,
      questionMinutes: 2,
      segments: [
        { title: 'Your track', detail: null, seconds: 120 },
        { title: 'Tend', detail: null, seconds: 60 },
      ],
      tips: ['Demo on a phone'],
    });
  });

  // L2-180 AC1, AC2: weights must total 100% before Next; then the honors and how each is chosen.
  test('a lead sets the judging criteria and the honors', async ({ page, api, axe }) => {
    const { event } = await arrange(api);
    const hub = new EventHubPage(page);
    const wizard = new HubSectionDialog(page, 'Judging and honors');

    await hub.openWizard('Judging and honors');
    await expect(wizard.question).toHaveText('How do judges score?');
    await wizard.number('Top score').fill('5');
    await wizard.button('Add a criterion').click();
    await wizard.rowField('Criterion 01', 'Criterion').fill('Redemptive potential');
    await wizard.rowField('Criterion 01', 'Weight %').fill('60');
    await wizard.button('Add a criterion').click();
    await wizard.rowField('Criterion 02', 'Criterion').fill('Technical viability');
    await wizard.rowField('Criterion 02', 'Weight %').fill('30');
    await expect(wizard.status('Weights add up to 90%')).toBeVisible();
    await wizard.next.click();
    await expect(wizard.text('Weights add up to 90%. Make them total 100%.')).toBeVisible();
    await expect(wizard.question).toHaveText('How do judges score?');
    await axe.check();

    await wizard.rowField('Criterion 01', 'Weight %').fill('70');
    await expect(wizard.status('Weights total 100%')).toBeVisible();
    await wizard.next.click();
    await expect(wizard.question).toHaveText('What can teams win?');
    await wizard.button('Add an honor').click();
    await wizard.rowField('Honor 01', 'Honor').fill('Most Creative');
    await wizard.rowField('Honor 01', 'How it’s chosen').selectOption({ label: 'Judges’ pick' });
    await axe.check();
    await wizard.save.click();

    await expect(hub.toast('Judging and honors saved')).toBeVisible();
    expect(api.events.hubs.section(event.id, 'Judging')?.content).toEqual({
      topScore: 5,
      criteria: [
        { title: 'Redemptive potential', question: null, topMark: null, weight: 70 },
        { title: 'Technical viability', question: null, topMark: null, weight: 30 },
      ],
      honors: [{ title: 'Most Creative', line: null, chosenBy: 'JudgesPick' }],
      note: null,
    });
  });

  // L2-176 AC1: tracks with an https link and one primary focus, then what good looks like.
  test('a lead adds tracks with a primary focus', async ({ page, api, axe }) => {
    const { event } = await arrange(api);
    const hub = new EventHubPage(page);
    const wizard = new HubSectionDialog(page, 'Tracks');

    await hub.openWizard('Tracks');
    await expect(wizard.question).toHaveText('Which tracks can teams choose?');
    await wizard.button('Add a track').click();
    await wizard.rowField('Track 01', 'Title').fill('Testimony sharing');
    await wizard.rowField('Track 01', 'Brief').fill('Help believers share what God has done.');
    await wizard.rowField('Track 01', 'Link').fill('http://example.org/brief');
    await wizard.next.click();
    await expect(wizard.text('Use a link that starts with https://')).toBeVisible();
    await wizard.rowField('Track 01', 'Link').fill('https://example.org/brief');
    await wizard.radio('Testimony sharing').check();
    await axe.check();
    await wizard.next.click();

    await expect(wizard.question).toHaveText('What does good look like?');
    await wizard.save.click();

    await expect(hub.toast('Tracks saved')).toBeVisible();
    expect(api.events.hubs.section(event.id, 'Tracks')?.content).toEqual({
      tracks: [
        {
          title: 'Testimony sharing',
          brief: 'Help believers share what God has done.',
          linkUrl: 'https://example.org/brief',
          linkText: null,
          primary: true,
        },
      ],
      goodLooksLike: [],
    });
  });

  // L2-177 AC1: the process's name, then stages whose points are "Title: detail" lines.
  test('a lead names the process and adds a stage with points', async ({ page, api, axe }) => {
    const { event } = await arrange(api);
    const hub = new EventHubPage(page);
    const wizard = new HubSectionDialog(page, 'Process');

    await hub.openWizard('Process');
    await expect(wizard.question).toHaveText('What do you call your process?');
    await wizard.field('Name').fill('The Create Cycle');
    await wizard.next.click();
    await expect(wizard.question).toHaveText('Stages');
    await wizard.button('Add a stage').click();
    await wizard.rowField('Stage 01', 'Title').fill('Lament');
    await wizard.rowField('Stage 01', 'When').fill('10:30 to 11:00');
    await wizard
      .rowField('Stage 01', 'Points')
      .fill('Listen: Whose pain have you heard?\nRemember');
    await axe.check();
    await wizard.save.click();

    await expect(hub.toast('Process saved')).toBeVisible();
    expect(api.events.hubs.section(event.id, 'Process')?.content).toEqual({
      name: 'The Create Cycle',
      intro: null,
      stages: [
        {
          title: 'Lament',
          when: '10:30 to 11:00',
          summary: null,
          points: [
            { title: 'Listen', detail: 'Whose pain have you heard?' },
            { title: 'Remember', detail: null },
          ],
        },
      ],
    });
  });

  // L2-181 AC1: songs with an https listen link.
  test('a lead adds a song to Worship', async ({ page, api, axe }) => {
    const { event } = await arrange(api);
    const hub = new EventHubPage(page);
    const wizard = new HubSectionDialog(page, 'Worship');

    await hub.openWizard('Worship');
    await expect(wizard.question).toHaveText('What will you sing?');
    await wizard.button('Add a song').click();
    await wizard.rowField('Song 01', 'Song').fill('Build My Life');
    await wizard.rowField('Song 01', 'Artist').fill('Housefires');
    await wizard.rowField('Song 01', 'Listen link').fill('http://example.org/song');
    await wizard.save.click();
    await expect(wizard.text('Use a link that starts with https://')).toBeVisible();
    await axe.check();
    await wizard.rowField('Song 01', 'Listen link').fill('https://example.org/song');
    await wizard.save.click();

    await expect(hub.toast('Worship saved')).toBeVisible();
    expect(api.events.hubs.section(event.id, 'Worship')?.content).toEqual({
      note: null,
      songs: [{ title: 'Build My Life', artist: 'Housefires', url: 'https://example.org/song' }],
    });
  });

  // L2-175 AC1: the organisation's partners, searched and ticked, with the paragraph.
  test('a lead picks a partner and introduces them', async ({ page, api, axe }) => {
    const { event } = await arrange(api);
    const partner = api.partners.add({
      name: 'Baptize The World',
      offering: 'A global movement uniting churches in baptism.',
      website: 'https://baptizetheworld.example.org',
    });
    api.partners.add({ name: 'Harbour Coffee Co.', offering: 'Coffee for the day.' });
    const hub = new EventHubPage(page);
    const wizard = new HubSectionDialog(page, 'Partners');

    await hub.openWizard('Partners');
    await expect(wizard.question).toHaveText('Which partners are you building with?');
    await wizard.dialog.getByRole('searchbox', { name: 'Search partners' }).fill('bapt');
    await expect(wizard.checkbox(/^Harbour Coffee/)).toHaveCount(0);
    await wizard.checkbox(/^Baptize The World/).check();
    await wizard.field('Meet our partner').fill('A global movement uniting churches in baptism.');
    await axe.check();
    await wizard.save.click();

    await expect(hub.toast('Partners saved')).toBeVisible();
    expect(api.events.hubs.section(event.id, 'Partners')?.content).toEqual({
      partnerIds: [partner.id],
      meet: 'A global movement uniting churches in baptism.',
    });
  });

  // L2-175 AC1: an organisation without partners is told where to add them.
  test('the Partners wizard says when there are no partners yet', async ({ page, api }) => {
    await arrange(api);
    const wizard = new HubSectionDialog(page, 'Partners');

    await new EventHubPage(page).openWizard('Partners');

    await expect(wizard.text('There are no partners yet. Add them in Partners.')).toBeVisible();
  });

  // L2-173 AC1: a parking option with a map image chosen from Resources.
  test('a lead adds a parking option with a map from Resources', async ({ page, api, axe }) => {
    const { event, grace } = await arrange(api);
    const map = api.resources.add({
      title: 'SoCal parking, on site',
      ownerId: grace.profileId,
      fileName: 'parking-on-site.jpg',
    });
    api.resources.add({ title: 'SoCal Hackathon slides', ownerId: grace.profileId });
    const hub = new EventHubPage(page);
    const wizard = new HubSectionDialog(page, 'Parking');
    const picker = new HubResourcePickerDialog(page);

    await hub.openWizard('Parking');
    await expect(wizard.question).toHaveText('What should people know first?');
    await wizard.field('Note').fill('Park on site first.');
    await wizard.next.click();
    await expect(wizard.question).toHaveText('Parking options');
    await wizard.button('Add an option').click();
    await wizard.rowField('Option 01', 'Name').fill('On site');
    await wizard.row('Option 01').getByRole('button', { name: 'Choose from Resources' }).click();

    await expect(picker.option('SoCal parking, on site')).toBeVisible();
    await expect(picker.option('SoCal Hackathon slides')).toHaveCount(0);
    await axe.check();
    await picker.option('SoCal parking, on site').check();
    await picker.choose.click();

    await expect(wizard.row('Option 01').getByText('SoCal parking, on site')).toBeVisible();
    await wizard.save.click();

    await expect(hub.toast('Parking saved')).toBeVisible();
    expect(api.events.hubs.section(event.id, 'Parking')?.content).toEqual({
      note: 'Park on site first.',
      options: [{ title: 'On site', notes: null, mapResourceId: map.id }],
    });
  });

  // L2-182 AC1: slides are images and PDFs from Resources, in order; any other file is refused.
  test('a lead chooses slides from Resources and orders them', async ({ page, api, axe }) => {
    const { event, grace } = await arrange(api);
    const welcome = api.resources.add({
      title: 'SoCal welcome slide',
      ownerId: grace.profileId,
      fileName: 'welcome.jpg',
    });
    const deck = api.resources.add({ title: 'SoCal Hackathon slides', ownerId: grace.profileId });
    api.resources.add({
      title: 'Budget',
      ownerId: grace.profileId,
      fileName: 'budget.xlsx',
    });
    const hub = new EventHubPage(page);
    const wizard = new HubSectionDialog(page, 'Slides');
    const picker = new HubResourcePickerDialog(page);

    await hub.openWizard('Slides');
    await expect(wizard.question).toHaveText('Which slides?');
    await wizard.upload('Upload slides').setInputFiles({
      name: 'notes.docx',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('PK'),
    });
    await expect(wizard.text('Choose a PDF or an image.')).toBeVisible();

    await wizard.button('Choose from Resources').click();
    await expect(picker.option('Budget')).toHaveCount(0);
    await picker.option('SoCal Hackathon slides').check();
    await picker.option('SoCal welcome slide').check();
    await picker.choose.click();
    await expect(wizard.rowHeadings()).toHaveText(['Slide 01', 'Slide 02']);
    await wizard.rowAction('Slide 02', 'up').click();
    await axe.check();
    await wizard.save.click();

    await expect(hub.toast('Slides saved')).toBeVisible();
    expect(api.events.hubs.section(event.id, 'Slides')?.content).toEqual({
      slides: [{ resourceId: welcome.id }, { resourceId: deck.id }],
    });
  });
});
