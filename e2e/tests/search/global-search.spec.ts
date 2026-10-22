// Traces to: L2-026 (docs/detailed-designs/search/global-search)
import { expect, test } from '../../fixtures/app';
import { MockApi } from '../../fixtures/mock-api';
import { SearchPage } from '../../pages/search.page';

function addCommunity(api: MockApi) {
  const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
  const ruth = api.addAccount({
    email: 'ruth@example.org',
    name: 'Ruth Alvarez',
    roles: ['Volunteer'],
  });
  const profile = api.profiles.get(ruth.profileId)!;
  profile.homeCity = 'Toronto';
  profile.bio = 'Led the shelter intake team';
  api.events.add({ title: 'Hackathon: Tech for Shelters', type: 'Hackathon' }, 14);
  api.partners.add({
    name: 'Lantern Foundation',
    stage: 'InFunnel',
    offering: 'Funds shelter technology',
  });
  api.contacts.add({
    ownerId: grace.profileId,
    name: 'Tomás Ortega',
    organization: 'Harbour Light Shelter',
  });
  api.contacts.add({
    ownerId: 'profile-99',
    name: 'Someone Else',
    organization: 'Another Shelter',
  });
  const workspace = api.agile.addWorkspace({ name: 'Toronto team', ownerId: grace.profileId });
  api.agile.addItem({
    workspaceId: workspace.id,
    kind: 'Story',
    title: 'Shelter problem briefs for teams',
  });
  return { grace, ruth };
}

test.describe('Global search', () => {
  // AC1, AC2: results are grouped, and a lead sees partners, their own contacts and their workspace items.
  test('a lead finds people, events, partners, work items and their own contacts', async ({
    page,
    api,
    axe,
  }) => {
    const { grace } = addCommunity(api);
    const search = new SearchPage(page);
    await api.signInAs(grace, '/search');

    await search.searchFor('shelter');

    await expect(page).toHaveURL(/\/search\?q=shelter$/);
    await expect
      .poll(() => search.groupHeadings())
      .toEqual([
        'People (1)',
        'Events (1)',
        'Partners (1)',
        'Your private contacts (1)',
        'Work items in your workspaces (1)',
      ]);
    expect(await search.titles('Your private contacts')).toEqual(['Tomás Ortega']);
    await axe.check();
    await page.emulateMedia({ colorScheme: 'dark' });
    await axe.check();
  });

  // AC2: a volunteer sees no partners, no one's contacts and no work items outside their workspaces.
  test('a volunteer finds only what they may open', async ({ page, api, axe }) => {
    const { ruth } = addCommunity(api);
    const search = new SearchPage(page);
    await api.signInAs(ruth, '/search');
    await search.open('shelter');

    await expect.poll(() => search.groupHeadings()).toEqual(['People (1)', 'Events (1)']);
    await axe.check();
  });

  test('the top bar searches from any page', async ({ page, api }) => {
    const { grace } = addCommunity(api);
    const search = new SearchPage(page);
    await api.signInAs(grace);

    await search.searchFromTopBar('lantern');

    await expect(page).toHaveURL(/\/search\?q=lantern$/);
    await expect.poll(() => search.titles('Partners')).toEqual(['Lantern Foundation']);
  });

  // AC3: no matches show an empty state that suggests other terms.
  test('no matches suggest other terms', async ({ page, api, axe }) => {
    const { grace } = addCommunity(api);
    const search = new SearchPage(page);
    await api.signInAs(grace, '/search');
    await search.open('zebra');

    await expect(search.noResults('zebra')).toBeVisible();
    await expect(page.getByText('Check the spelling, try fewer words')).toBeVisible();
    await axe.check();
  });

  // AC4: a term under 2 characters runs no search and shows a hint.
  test('a one-letter term shows the hint and runs no search', async ({ page, api, axe }) => {
    const { grace } = addCommunity(api);
    const search = new SearchPage(page);
    await api.signInAs(grace, '/search');

    await search.searchFor('s');

    await expect(search.hint).toBeVisible();
    expect(api.callsTo('GET', '/api/search')).toHaveLength(0);
    await axe.check();
  });
});
