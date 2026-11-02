import { expect, test } from '../../../e2e/fixtures/app';
import { ResourcePage } from '../../../e2e/pages/resource.page';
import { ResourcesPage } from '../../../e2e/pages/resources.page';
import { Presenter, typeInto } from '../presenter';

// Journey: find and download resources (docs/detailed-designs/resources/list-and-find and resource-page, L2-055,
// L2-056, L2-060).
test('find-and-download-resources', async ({ page, api }) => {
  const show = await Presenter.start(page, 'find-and-download-resources');
  const resources = new ResourcesPage(page);
  const resource = new ResourcePage(page);
  const grace = api.addAccount({
    email: 'grace@example.org',
    name: 'Grace Okonkwo',
    roles: ['CityLead'],
  });
  const marcus = api.addAccount({
    email: 'marcus@example.org',
    name: 'Marcus Lee',
    roles: ['EventLead'],
  });
  const samuel = api.addAccount({
    email: 'samuel@example.org',
    name: 'Samuel Mensah',
    roles: ['Volunteer'],
  });
  api.resources.add(
    {
      title: 'Hackathon kickoff deck',
      ownerId: marcus.profileId,
      type: 'deck',
      tags: ['hackathon'],
      fileName: 'kickoff.pptx',
      size: 12_582_912,
    },
    5,
  );
  api.resources.add(
    {
      title: 'Hackathon judging rubric',
      ownerId: marcus.profileId,
      type: 'template',
      tags: ['hackathon'],
      description: 'How judges score each team.',
      linkUrl: 'https://docs.google.com/spreadsheets/d/1',
    },
    4,
  );
  api.resources.add(
    {
      title: 'Volunteer training: welcome and safety',
      ownerId: grace.profileId,
      type: 'training',
      tags: ['volunteers'],
      fileName: 'welcome-and-safety.pdf',
      size: 3_250_586,
    },
    3,
  );
  api.resources.add(
    {
      title: 'City launch deck',
      ownerId: grace.profileId,
      type: 'deck',
      tags: ['launch'],
      fileName: 'city-launch-deck.pptx',
      size: 25_794_970,
    },
    2,
  );
  api.resources.add(
    {
      title: 'Austin launch retro',
      ownerId: marcus.profileId,
      type: 'deck',
      fileName: 'retro.key',
      size: 33_344_716,
      visibility: 'Shared',
      roles: ['Volunteer'],
    },
    1,
  );

  await show.card(
    'opening',
    'opening',
    [
      'Find and download resources',
      'Recorded against a local fake API · synthetic people and files',
    ],
    () => api.signInAs(samuel, '/resources'),
  );

  await show.step('list', async () => {
    await expect(resources.items).toHaveCount(5);
  });

  await show.step('filter', async () => {
    await resources.tag.selectOption('hackathon');
    await expect(resources.filterLine).toHaveText('2 resources tagged “hackathon”');
    await resources.type('Deck').click();
    await expect.poll(() => resources.titles()).toEqual(['Hackathon kickoff deck']);
  });

  await show.step('search', async () => {
    await resources.clearFilters.click();
    await typeInto(resources.search, 'judges');
    await expect.poll(() => resources.titles()).toEqual(['Hackathon judging rubric']);
  });

  await show.step('no-results', async () => {
    await resources.search.fill('');
    await typeInto(resources.search, 'budget');
    await expect(resources.noResults('budget')).toBeVisible();
    await resources.clearSearch.click();
    await expect(resources.items).toHaveCount(5);
  });

  await show.step('download', async () => {
    const download = page.waitForEvent('download');
    await resources.download('Volunteer training: welcome and safety').click();
    expect((await download).suggestedFilename()).toBe('welcome-and-safety.pdf');
  });

  await show.step(
    'details',
    async () => {
      await resources
        .item('City launch deck')
        .getByRole('link', { name: 'City launch deck' })
        .click();
      await expect(resource.heading).toHaveText('City launch deck');
      await expect(resource.download).toBeVisible();
    },
    { poster: true },
  );

  await show.card('closing', 'closing', [
    'Only what you may open',
    'Filter by type and tag, or search',
    'Download under the original name',
  ]);
  await show.finish();
});
