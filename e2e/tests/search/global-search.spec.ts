import { expect, test } from '../../fixtures/app';
import { AppShell } from '../../pages/app-shell.page';
import { SearchPage } from '../../pages/search.page';

// L2-026 (docs/detailed-designs/search/global-search).
test.describe('Global search', () => {
  test('a lead gets results grouped by kind, with only their own contacts', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const marcus = api.addAccount({
      email: 'marcus@example.org',
      name: 'Marcus Lee',
      roles: ['EventLead'],
    });
    api.addAccount({ email: 'ruth@example.org', name: 'Ruth Alvarez' });
    api.profiles.get(api.accounts.get('ruth@example.org')!.profileId)!.bio =
      'Led the shelter intake team';
    api.events.add({ title: 'Hackathon: Tech for Shelters' }, 20);
    api.partners.add({ name: 'Lantern Foundation', offering: 'Funds shelter technology' });
    api.contacts.add({
      ownerId: grace.profileId,
      name: 'Tomás Ortega',
      organization: 'Harbour Light Shelter',
    });
    api.contacts.add({
      ownerId: marcus.profileId,
      name: 'Abby Brooks',
      organization: 'Shelter Co',
    });
    const workspace = api.agile.addWorkspace({ name: 'Toronto team', ownerId: grace.profileId });
    api.agile.addItem({
      workspaceId: workspace.id,
      kind: 'Story',
      title: 'Shelter problem briefs',
    });
    const search = new SearchPage(page);

    await api.signInAs(grace, '/search');
    await search.searchFor('shelter');

    await expect(search.status).toHaveText('5 results for “shelter”');
    expect(await search.groupHeadings()).toEqual([
      'People (1)',
      'Events (1)',
      'Partners (1)',
      'Your private contacts (1)',
      'Work items in your workspaces (1)',
    ]);
    await expect(search.result('Tomás Ortega')).toBeVisible();
    await expect(search.result('Abby Brooks')).toHaveCount(0);
    await expect(page).toHaveURL(/\/search\?q=shelter$/);
    await axe.check();
  });

  test('a member without a lead role sees no partners or contacts', async ({ page, api }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const jonah = api.addAccount({
      email: 'jonah@example.org',
      name: 'Jonah Bell',
      roles: ['ProductEngineer'],
    });
    api.events.add({ title: 'Hackathon: Tech for Shelters' }, 20);
    api.partners.add({ name: 'Shelter Partners' });
    api.contacts.add({ ownerId: grace.profileId, name: 'Shelter Contact' });
    const search = new SearchPage(page);

    await api.signInAs(jonah, '/');
    await search.goto('shelter');

    await expect(search.status).toHaveText('1 result for “shelter”');
    expect(await search.groupHeadings()).toEqual(['Events (1)']);
  });

  test('the top bar search opens the results page', async ({ page, api }) => {
    const grace = api.addAccount({ email: 'grace@example.org' });
    api.events.add({ title: 'Toronto Builders Night' }, 5);
    const search = new SearchPage(page);
    await api.signInAs(grace, '/team');

    await new AppShell(page).searchFromTopBar('builders');

    await expect(search.heading).toBeVisible();
    await expect(search.result('Toronto Builders Night')).toBeVisible();
  });

  test('no matches suggest other terms', async ({ page, api, axe }) => {
    const search = new SearchPage(page);
    await api.signInAs(api.addAccount({ email: 'grace@example.org' }), '/');

    await search.goto('zebra crossing');

    await expect(search.emptyState).toContainText('No results for “zebra crossing”');
    await axe.check();
  });

  test('a term under 2 characters shows a hint and runs no search', async ({ page, api, axe }) => {
    const search = new SearchPage(page);
    await api.signInAs(api.addAccount({ email: 'grace@example.org' }), '/search');

    await search.searchFor('a');

    await expect(search.hint).toBeVisible();
    expect(api.callsTo('GET', '/api/search')).toHaveLength(0);
    await axe.check();
  });

  test('before searching, the page explains what can be found', async ({ page, api, axe }) => {
    const search = new SearchPage(page);
    await api.signInAs(api.addAccount({ email: 'grace@example.org' }), '/search');

    await expect(search.emptyState).toContainText('Search all of FaithTech');
    await axe.check();
  });
});
