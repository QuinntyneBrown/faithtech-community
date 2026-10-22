// Traces to: L2-055, L2-058 AC4, L2-060 (docs/detailed-designs/resources/list-and-find)
import { expect, test } from '../../fixtures/app';
import { ResourcesPage } from '../../pages/resources.page';

test.describe('Resources: list, filter and find', () => {
  test('lists what the member may open, newest first, with type, size, owner and visibility', async ({
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
      roles: ['EventLead'],
    });
    const samuel = api.addAccount({
      email: 'samuel@example.org',
      name: 'Samuel Mensah',
      roles: ['Volunteer'],
    });
    api.resources.add(
      {
        title: 'Volunteer training: welcome and safety',
        ownerId: grace.profileId,
        type: 'Training',
        fileName: 'welcome.pdf',
        size: 3_250_586,
      },
      3,
    );
    api.resources.add(
      {
        title: 'Hackathon judging rubric',
        ownerId: marcus.profileId,
        type: 'Template',
        linkUrl: 'https://docs.google.com/spreadsheets/d/1',
      },
      2,
    );
    api.resources.add(
      {
        title: 'Austin launch retro',
        ownerId: marcus.profileId,
        type: 'Deck',
        fileName: 'retro.key',
        size: 33_344_716,
        visibility: 'Shared',
        roles: ['Volunteer'],
      },
      1,
    );
    api.resources.add({
      title: 'Sponsor budget 2027 draft',
      ownerId: grace.profileId,
      visibility: 'Private',
    });
    await api.freezeBrowserClock();
    await api.signInAs(samuel, '/resources');

    const resources = new ResourcesPage(page);
    await expect(resources.heading).toHaveText('Resources');
    await expect(resources.subtitle).toHaveText(
      'Decks, logos, training and templates · 3 resources',
    );
    expect(await resources.titles()).toEqual([
      'Austin launch retro',
      'Hackathon judging rubric',
      'Volunteer training: welcome and safety',
    ]);
    await expect(resources.item('Austin launch retro')).toContainText(
      'Deck · KEY · 31.8 MB · Marcus Lee · Tue 20 Oct',
    );
    await expect(resources.item('Austin launch retro')).toContainText('Shared with you');
    await expect(resources.item('Hackathon judging rubric')).toContainText(
      'Template · docs.google.com · Marcus Lee',
    );
    await expect(resources.add).toHaveCount(0);
    await expect(resources.archived).toHaveCount(0);
    await axe.check();

    const link = resources.openLink('Hackathon judging rubric');
    await expect(link).toHaveAttribute('href', 'https://docs.google.com/spreadsheets/d/1');
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener');
  });

  test('downloads a file under its original name', async ({ page, api }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    api.resources.add({
      title: 'City launch deck',
      ownerId: grace.profileId,
      type: 'Deck',
      fileName: 'city-launch-deck.pptx',
      size: 4,
    });
    await api.signInAs(grace, '/resources');
    const resources = new ResourcesPage(page);

    const download = page.waitForEvent('download');
    await resources.download('City launch deck').click();

    expect((await download).suggestedFilename()).toBe('city-launch-deck.pptx');
  });

  test('filters by type and tag, and clears the filters', async ({ page, api, axe }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    api.resources.add(
      { title: 'Kickoff deck', ownerId: grace.profileId, type: 'Deck', tags: ['hackathon'] },
      2,
    );
    api.resources.add(
      { title: 'Judging rubric', ownerId: grace.profileId, type: 'Template', tags: ['hackathon'] },
      1,
    );
    api.resources.add({
      title: 'Launch deck',
      ownerId: grace.profileId,
      type: 'Deck',
      tags: ['launch'],
    });
    await api.signInAs(grace, '/resources');
    const resources = new ResourcesPage(page);
    await expect(resources.items).toHaveCount(3);

    await resources.tag.selectOption('hackathon');
    await expect(resources.filterLine).toHaveText('2 resources tagged “hackathon”');
    await resources.type('Deck').click();
    expect(await resources.titles()).toEqual(['Kickoff deck']);
    await axe.check();

    await resources.clearFilters.click();
    await expect(resources.items).toHaveCount(3);
    await expect(resources.type('All types')).toHaveAttribute('aria-pressed', 'true');
  });

  test('searches titles, descriptions, tags and file names, and says when nothing matches', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    api.resources.add({
      title: 'Judging rubric',
      ownerId: grace.profileId,
      description: 'How judges score a hackathon.',
    });
    api.resources.add({
      title: 'Launch deck',
      ownerId: grace.profileId,
      fileName: 'city-launch.pptx',
    });
    await api.signInAs(grace, '/resources');
    const resources = new ResourcesPage(page);

    await resources.search.fill('judges');
    await expect(resources.items).toHaveCount(1);
    expect(await resources.titles()).toEqual(['Judging rubric']);

    await resources.search.fill('budget');
    await expect(resources.noResults('budget')).toBeVisible();
    await expect(page.getByText('not the text inside files')).toBeVisible();
    await axe.check();
    await resources.clearSearch.click();
    await expect(resources.items).toHaveCount(2);
  });

  test('shows the empty state, with Add the first resource for a contributor', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    await api.signInAs(grace, '/resources');
    const resources = new ResourcesPage(page);

    await expect(resources.subtitle).toHaveText('Decks, logos, training and templates · none yet');
    await expect(resources.empty).toBeVisible();
    await expect(resources.addFirst).toBeVisible();
    await expect(resources.archived).toBeVisible();
    await axe.check();
  });

  test('offers Try again when the list fails to load', async ({ page, api, axe }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    let fail = true;
    api.on('GET', '/api/resources', (route) =>
      fail ? route.fulfill({ status: 503 }) : api.fallback(route),
    );
    await api.signInAs(grace, '/resources');
    const resources = new ResourcesPage(page);

    await expect(resources.error).toBeVisible();
    await axe.check();
    fail = false;
    await resources.tryAgain.click();
    await expect(resources.empty).toBeVisible();
  });

  test('sends an anonymous visitor to sign in', async ({ page }) => {
    await page.goto('/resources');
    await expect(page).toHaveURL(/\/sign-in\?returnUrl=%2Fresources/);
  });
});
