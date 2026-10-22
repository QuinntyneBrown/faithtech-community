// Traces to: L2-096 (docs/detailed-designs/notes/archive-and-search)
import { expect, test } from '../../fixtures/app';
import { NotesPage } from '../../pages/notes.page';
import { SearchPage } from '../../pages/search.page';

test('global search has a Notes group with only the pages the member may open', async ({
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
  api.notes.add({ title: 'Kestrel Labs booking', icon: '📅', ownerId: grace.profileId });
  api.notes.add({
    title: 'Run sheet',
    ownerId: marcus.profileId,
    visibility: 'Global',
    blocks: [
      { id: 'b', type: 'paragraph', text: [{ text: 'Confirm the room with Kestrel Labs' }] },
    ],
  });
  api.notes.add({ title: 'Kestrel contract', ownerId: marcus.profileId });
  api.notes.add({
    title: 'Kestrel old notes',
    ownerId: grace.profileId,
    archivedAt: new Date(Date.UTC(2026, 9, 1)).toISOString(),
  });
  await api.signInAs(grace, '/search');
  const search = new SearchPage(page);
  await search.searchFor('kestrel');

  expect(await search.groupHeadings()).toEqual(['Notes (2)']);
  await expect(search.groups).toContainText('Marcus Lee');
  await expect(search.groups).toContainText('Confirm the room with Kestrel Labs');
  await expect(search.groups).toContainText('Private');
  await expect(search.result('Kestrel contract')).toHaveCount(0);
  await axe.check();

  await page.getByRole('link', { name: 'See all in Notes' }).click();
  const notes = new NotesPage(page);
  await expect(notes.search).toHaveValue('kestrel');
  await expect(notes.items).toHaveCount(2);
});
