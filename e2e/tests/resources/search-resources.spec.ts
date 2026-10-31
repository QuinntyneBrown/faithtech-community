// Traces to: L2-065 (docs/detailed-designs/resources/list-and-find)
import { expect, test } from '../../fixtures/app';
import { ResourcesPage } from '../../pages/resources.page';
import { SearchPage } from '../../pages/search.page';

test('global search has a Resources group with only what the member may open', async ({
  page,
  api,
  axe,
}) => {
  const grace = api.addAccount({
    email: 'grace@example.org',
    name: 'Grace Okonkwo',
    roles: ['CityLead'],
  });
  const marcus = api.addAccount({
    email: 'marcus@example.org',
    name: 'Marcus Lee',
    roles: ['CityLead'],
  });
  api.resources.add({
    title: 'City launch deck',
    ownerId: grace.profileId,
    type: 'deck',
    fileName: 'deck.pptx',
  });
  api.resources.add({
    title: 'Austin retro',
    ownerId: marcus.profileId,
    type: 'deck',
    fileName: 'retro.key',
    tags: ['launch'],
    visibility: 'Shared',
    memberIds: [grace.profileId],
  });
  api.resources.add({
    title: 'Marcus launch notes',
    ownerId: marcus.profileId,
    visibility: 'Private',
  });
  await api.signInAs(grace, '/search');
  const search = new SearchPage(page);
  await search.searchFor('launch');

  await expect.poll(() => search.groupHeadings()).toEqual(['Resources (2)']);
  await expect(search.groups).toContainText('Deck · KEY · Marcus Lee · tagged launch');
  await expect(search.groups).toContainText('Shared with you');
  await expect(search.result('Marcus launch notes')).toHaveCount(0);
  await axe.check();

  await page.getByRole('link', { name: 'See all in Resources' }).click();
  const resources = new ResourcesPage(page);
  await expect(resources.search).toHaveValue('launch');
  await expect(resources.items).toHaveCount(2);
});
