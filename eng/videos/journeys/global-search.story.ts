import { expect, test } from '../../../e2e/fixtures/app';
import { AppShell } from '../../../e2e/pages/app-shell.page';
import { SearchPage } from '../../../e2e/pages/search.page';
import { Presenter, typeInto } from '../presenter';

// Journey: global search (docs/detailed-designs/search/global-search, L2-026).
test('global-search', async ({ page, api }) => {
  const show = await Presenter.start(page, 'global-search');
  const search = new SearchPage(page);
  const shell = new AppShell(page);

  const grace = api.addAccount({
    email: 'grace@example.org',
    name: 'Grace Okafor',
    roles: ['CityLead'],
  });
  const marcus = api.addAccount({
    email: 'marcus@example.org',
    name: 'Marcus Lee',
    roles: ['EventLead'],
  });
  api.addAccount({ email: 'ruth@example.org', name: 'Ruth Alvarez' });
  api.profiles.get(api.accounts.get('ruth@example.org')!.profileId)!.bio =
    'Led the shelter intake team';
  api.events.add({ title: 'Hackathon: Tech for Shelters' }, 20);
  api.events.add({ title: 'Toronto Builders Night' }, 5);
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
  api.agile.addItem({ workspaceId: workspace.id, kind: 'Story', title: 'Shelter problem briefs' });

  await show.card(
    'opening',
    'opening',
    [
      'Find anything in the community',
      'Recorded against a local fake API · synthetic people and events',
    ],
    () => api.signInAs(grace, '/search'),
  );

  await show.step('intro', async () => {
    await expect(search.emptyState).toContainText('Search all of FaithTech');
  });

  await show.step(
    'results',
    async () => {
      await typeInto(search.box, 'shelter');
      await search.submit.click();
      await expect(search.status).toHaveText('5 results for “shelter”');
    },
    { poster: true },
  );

  await show.step('private', async () => {
    await expect(search.result('Tomás Ortega')).toBeVisible();
    await expect(search.result('Abby Brooks')).toHaveCount(0);
    await search.result('Tomás Ortega').scrollIntoViewIfNeeded();
  });

  await show.step('top-bar', async () => {
    await shell.topSearch.fill('builders');
    await shell.topSearch.press('Enter');
    await expect(search.result('Toronto Builders Night')).toBeVisible();
  });

  await show.step('short', async () => {
    await search.searchFor('a');
    await expect(search.hint).toBeVisible();
  });

  await show.step('none', async () => {
    await search.searchFor('zebra crossing');
    await expect(search.emptyState).toContainText('No results for “zebra crossing”');
  });

  await show.card('closing', 'closing', [
    'One box for people, events, partners and more',
    'Results grouped with counts',
    'Only what you may see',
  ]);
  await show.finish();
});
