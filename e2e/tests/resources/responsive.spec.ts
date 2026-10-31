// Traces to: L2-055 AC11, L2-056 AC10, L2-057 AC12 with L2-045 AC1
import { expect, test } from '../../fixtures/app';
import { AddResourceDialog } from '../../pages/resource.dialogs';
import { ArchivedResourcesPage } from '../../pages/archived-resources.page';
import { ResourcePage } from '../../pages/resource.page';
import { ResourcesPage } from '../../pages/resources.page';
import {
  BREAKPOINTS,
  BreakpointName,
  hasHorizontalScroll,
  undersizedTargets,
} from '../../pages/viewport';

for (const name of Object.keys(BREAKPOINTS) as BreakpointName[]) {
  test(`the resources screens fit and keep 24px targets at ${name}`, async ({ page, api }) => {
    await page.setViewportSize(BREAKPOINTS[name]);
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const deck = api.resources.add({
      title: 'City launch deck with a long title that wraps on phones',
      ownerId: grace.profileId,
      type: 'deck',
      fileName: 'city-launch-deck-final-version.pptx',
      tags: ['launch'],
      visibility: 'Shared',
      roles: ['Volunteer'],
    });
    api.resources.add({
      title: 'Judging rubric',
      ownerId: grace.profileId,
      type: 'template',
      linkUrl: 'https://docs.google.com/d/1',
    });
    api.resources.add({
      title: 'Old budget',
      ownerId: grace.profileId,
      archivedAt: '2026-10-13T12:00:00.000Z',
    });

    await api.signInAs(grace, '/resources');
    const resources = new ResourcesPage(page);
    await expect(resources.items).toHaveCount(2);
    expect(await hasHorizontalScroll(page), 'resources').toBe(false);
    expect(await undersizedTargets(page), 'resources').toEqual([]);

    await resources.add.click();
    const dialog = new AddResourceDialog(page);
    await dialog.opened();
    expect(await hasHorizontalScroll(page), 'add resource').toBe(false);
    await dialog.cancel.click();

    const resource = new ResourcePage(page);
    await resource.open(deck.id);
    await expect(resource.heading).toBeVisible();
    expect(await hasHorizontalScroll(page), 'resource').toBe(false);
    expect(await undersizedTargets(page), 'resource').toEqual([]);

    const archived = new ArchivedResourcesPage(page);
    await archived.open();
    await expect(archived.item('Old budget')).toBeVisible();
    expect(await hasHorizontalScroll(page), 'archived').toBe(false);
  });
}
