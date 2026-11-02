// Traces to: L2-173 AC3, L2-174 AC2, L2-175 AC3, L2-176 AC2, L2-177 AC2, L2-178 AC2, L2-179 AC3, L2-180 AC3, L2-181 AC2,
// L2-182 AC2, AC3 (docs/detailed-designs/events/build-hackathon-hub)
import { expect, test } from '../../fixtures/app';
import { MockApi } from '../../fixtures/mock-api';
import { HubPage } from '../../pages/hub.page';

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

/** A published SoCal Hackathon hub with every hackathon section filled in, as its wizards would save them. */
function arrange(api: MockApi) {
  const event = api.events.add({
    title: 'SoCal Hackathon',
    startsAt: '2026-10-24T16:00:00.000Z',
    endsAt: '2026-10-25T01:00:00.000Z',
    visibility: 'Public',
  });
  const grace = api.addAccount({
    email: 'grace@example.org',
    name: 'Grace Okonkwo',
    roles: ['CityLead'],
  });
  const map = api.resources.add({
    title: 'SoCal parking, on site',
    ownerId: grace.profileId,
    fileName: 'parking-on-site.jpg',
    visibility: 'Private',
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
  const partner = api.partners.add({
    name: 'Baptize The World',
    offering: 'Challenge statements and test data for three tracks',
    website: 'https://baptizetheworld.example.org',
  });
  const hubs = api.events.hubs;
  hubs.add(event, [], [...OPTIONAL]);
  hubs.fill(event.id, 'Parking', {
    note: 'Park on site first.',
    options: [
      { title: 'On site · 75 spots', notes: 'Enter from Robertson Pl.', mapResourceId: map.id },
    ],
  });
  hubs.fill(event.id, 'WhatToBring', {
    bring: ['Your laptop and charger'],
    onTheDay: [{ title: 'Raise a hand', detail: 'Stuck for 15 minutes? Ask.' }],
  });
  hubs.fill(event.id, 'Partners', {
    partnerIds: [partner.id],
    meet: 'A global movement uniting churches in baptism.',
  });
  hubs.fill(event.id, 'Tracks', {
    tracks: [
      {
        title: 'Church onboarding',
        brief: 'Register from a phone.',
        linkUrl: 'https://example.org/1',
        linkText: null,
        primary: true,
      },
      {
        title: 'Testimony sharing',
        brief: 'Tell the story.',
        linkUrl: null,
        linkText: null,
        primary: false,
      },
    ],
    goodLooksLike: [
      { title: 'Done in one sitting', detail: 'A busy pastor finishes in one conversation.' },
    ],
  });
  hubs.fill(event.id, 'Process', {
    name: 'The Create Cycle',
    intro: 'Redemptive technology starts before the code.',
    stages: [
      {
        title: 'Lament',
        when: '10:30 to 11:00',
        summary: 'We patiently refuse to rush past pain.',
        points: [{ title: 'Listen', detail: 'Whose pain have you heard?' }],
      },
    ],
  });
  hubs.fill(event.id, 'Rules', {
    rules: [
      { title: 'Start fresh', detail: 'The code starts today.' },
      { title: 'Any stack', detail: null },
    ],
    note: 'Use a public repo.',
  });
  hubs.fill(event.id, 'DemoFormat', {
    minutes: 3,
    questionMinutes: 2,
    segments: [
      { title: 'Your track', detail: 'Who it’s for.', seconds: 30 },
      { title: 'Tend', detail: 'Show it working, live.', seconds: 90 },
    ],
    tips: ['Demo on a phone'],
  });
  hubs.fill(event.id, 'Judging', {
    topScore: 5,
    criteria: [
      {
        title: 'Redemptive potential',
        question: 'Could this reach real people?',
        topMark: 'Long after today.',
        weight: 60,
      },
      { title: 'Technical viability', question: null, topMark: null, weight: 40 },
    ],
    honors: [
      { title: 'Most Creative', line: 'The most imaginative answer.', chosenBy: 'JudgesPick' },
    ],
    note: 'Winning teams take home bags of coffee.',
  });
  hubs.fill(event.id, 'Worship', {
    note: 'Three songs to start the day.',
    songs: [{ title: 'Holy Forever', artist: 'Chris Tomlin', url: 'https://example.org/holy' }],
  });
  hubs.fill(event.id, 'Slides', {
    slides: [{ resourceId: welcome.id }, { resourceId: tracks.id }],
  });
  hubs.publish(event.id);
  return { event, map, welcome, tracks };
}

test.describe('Hub page: hackathon sections', () => {
  // L2-173 AC3 to L2-182 AC2: an anonymous visitor reads every hackathon section, in catalogue order among the core ones.
  test('a visitor reads every hackathon section', async ({ page, api, axe }) => {
    const { event, map } = arrange(api);
    const hub = new HubPage(page);

    await hub.open(event.id);

    await expect(hub.sectionHeadings).toHaveText([
      'SoCal Hackathon',
      'Where',
      'Parking',
      'What to bring',
      'Partners',
      'Tracks',
      'The Create Cycle',
      'Rules',
      'Demo format',
      'Judging and honors',
      'Worship',
      'Slides',
      'Giving',
    ]);
    const parking = hub.region('Parking');
    await expect(parking).toContainText('Park on site first.');
    await expect(
      parking.getByRole('link', { name: /View full size map, On site/ }),
    ).toHaveAttribute('href', new RegExp(`/api/events/${event.id}/hub/files/${map.id}$`));
    expect(await hub.imageLoaded(parking.getByRole('img').first())).toBe(true);
    await expect(hub.region('What to bring')).toContainText('Raise a hand');
    const partners = hub.region('Partners');
    await expect(partners).toContainText('A global movement uniting churches in baptism.');
    await expect(partners).toContainText('BT');
    await expect(partners).toContainText('Challenge statements and test data for three tracks');
    await expect(hub.region('Tracks')).toContainText('Track 1 · Primary focus');
    await expect(hub.region('Tracks')).toContainText('What good looks like');
    await expect(hub.region('The Create Cycle')).toContainText('10:30 to 11:00');
    await expect(hub.region('Rules').getByRole('listitem')).toHaveText([
      /^01\s*Start fresh\s*The code starts today\.$/,
      /^02\s*Any stack$/,
    ]);
    await expect(hub.region('Demo format')).toContainText(
      'Three minutes per team, then two minutes of questions.',
    );
    await expect(hub.region('Demo format')).toContainText('0:30 to 2:00');
    await expect(hub.region('Judging and honors')).toContainText(
      'Judges score each team 1 to 5 on each criterion.',
    );
    await expect(hub.region('Judging and honors')).toContainText('Redemptive potential (60%)');
    await expect(hub.region('Judging and honors')).toContainText('Honor 01 · Judges’ pick');
    await expect(
      hub.region('Worship').getByRole('link', { name: 'Listen ahead to Holy Forever (new tab)' }),
    ).toBeVisible();
    await axe.check();
  });

  // L2-182 AC2: the slides, one after another, with the arrow keys and Previous and Next.
  test('a visitor steps through the slides', async ({ page, api, axe }) => {
    const { event } = arrange(api);
    const hub = new HubPage(page);

    await hub.open(event.id);
    const slides = hub.region('Slides');
    await expect(slides.getByRole('status')).toContainText('Slide 1 of 2');
    await slides.getByRole('button', { name: 'Next slide' }).click();
    await expect(slides.getByRole('status')).toContainText('Slide 2 of 2');
    await page.keyboard.press('ArrowLeft');
    await expect(slides.getByRole('status')).toContainText('Slide 1 of 2');
    await axe.check();
  });

  // L2-182 AC3: a file is served only while a shown section names it.
  test('a hidden section’s map is no longer served', async ({ page, api }) => {
    const { event, map } = arrange(api);
    const hub = new HubPage(page);
    await hub.open(event.id);

    expect(await hub.fileStatus(event.id, map.id)).toBe(200);
    api.events.hubs.section(event.id, 'Parking')!.visible = false;
    expect(await hub.fileStatus(event.id, map.id)).toBe(404);
  });
});
