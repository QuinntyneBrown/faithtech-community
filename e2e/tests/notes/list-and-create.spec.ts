// Traces to: L2-085, L2-092 (docs/detailed-designs/notes/pages-and-list)
import { expect, test } from '../../fixtures/app';
import { AppShell } from '../../pages/app-shell.page';
import { NotePage } from '../../pages/note.page';
import { NotesPage } from '../../pages/notes.page';

test.describe('Notes: list and create', () => {
  test('a member with no role creates their first page from the empty list', async ({
    page,
    api,
    axe,
  }) => {
    const samuel = api.addAccount({ email: 'samuel@example.org', name: 'Samuel Mensah' });
    await api.signInAs(samuel, '/');
    await new AppShell(page).navLink('Notes').click();
    const notes = new NotesPage(page);

    await expect(notes.heading).toHaveText('Notes');
    await expect(notes.subtitle).toHaveText('Meeting notes, playbooks and how-tos · none yet');
    await expect(notes.empty).toBeVisible();
    await axe.check();
    await notes.createFirst.click();

    const note = new NotePage(page);
    await expect(note.title).toBeVisible();
    await expect(note.title).toHaveAttribute('aria-placeholder', 'Untitled');
    const created = api.notes.pages[0];
    expect(created).toMatchObject({ title: '', visibility: 'Private', ownerId: samuel.profileId });
    await expect(page).toHaveURL(`/notes/${created.id}`);
    await axe.check();
  });

  test('lists the pages the member may open, recently edited first, and finds them', async ({
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
    const esther = api.addAccount({
      email: 'esther@example.org',
      name: 'Esther Nakamura',
      roles: ['Staff'],
    });
    api.notes.add(
      { title: 'Hackathon judging how-to', ownerId: marcus.profileId, visibility: 'Global' },
      3,
    );
    api.notes.add(
      {
        title: 'Q4 planning notes',
        ownerId: esther.profileId,
        visibility: 'Shared',
        roles: ['CityLead'],
      },
      2,
    );
    api.notes.add(
      { title: 'Partner meeting notes — Shopify, 14 Oct', ownerId: grace.profileId },
      1,
    );
    api.notes.add({ title: 'Marcus’s private draft', ownerId: marcus.profileId });
    await api.signInAs(grace, '/notes');
    const notes = new NotesPage(page);

    await expect(notes.subtitle).toHaveText('Meeting notes, playbooks and how-tos · 3 pages');
    await expect(notes.itemTitles).toHaveText([
      'Partner meeting notes — Shopify, 14 Oct',
      'Q4 planning notes',
      'Hackathon judging how-to',
    ]);
    await expect(notes.item('Partner meeting notes — Shopify, 14 Oct')).toContainText('Private');
    await expect(notes.item('Q4 planning notes')).toContainText('Shared with you');
    await expect(notes.item('Hackathon judging how-to')).toContainText('Marcus Lee');
    await axe.check();

    await notes.owner('Shared with me').click();
    await expect(notes.itemTitles).toHaveText(['Q4 planning notes']);
    await notes.owner('Mine').click();
    await expect(notes.itemTitles).toHaveText(['Partner meeting notes — Shopify, 14 Oct']);
    await notes.owner('All pages').click();

    await notes.search.fill('judging');
    await expect(notes.items).toHaveCount(1);
    await notes.search.fill('zebra');
    await expect(notes.noResults('zebra')).toBeVisible();
    await axe.check();
    await notes.clearSearch.click();
    await expect(notes.items).toHaveCount(3);
  });

  test('offers Try again when the list fails to load', async ({ page, api, axe }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    let fail = true;
    api.on('GET', '/api/notes', (route) =>
      fail ? route.fulfill({ status: 503 }) : api.fallback(route),
    );
    await api.signInAs(grace, '/notes');
    const notes = new NotesPage(page);

    await expect(notes.error).toBeVisible();
    await axe.check();
    fail = false;
    await notes.tryAgain.click();
    await expect(notes.empty).toBeVisible();
  });

  test('a member whose email is not verified is told to verify it before creating a page', async ({
    page,
    api,
  }) => {
    const samuel = api.addAccount({ email: 'samuel@example.org', verified: false });
    await api.signInAs(samuel, '/notes');
    const notes = new NotesPage(page);

    await notes.newPage.click();

    await expect(notes.toast).toContainText('Verify your email before creating pages.');
    await expect(page).toHaveURL('/notes');
    expect(api.notes.pages).toHaveLength(0);
  });

  test('sends an anonymous visitor to sign in', async ({ page }) => {
    await page.goto('/notes');
    await expect(page).toHaveURL(/\/sign-in\?returnUrl=%2Fnotes/);
  });
});
