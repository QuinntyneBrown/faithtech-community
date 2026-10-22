// Traces to: L2-021 with L2-045 AC1 (docs/detailed-designs/platform/responsive-layout-and-theming)
import { expect, test } from '../../fixtures/app';
import { EventsPage } from '../../pages/events.page';
import {
  BREAKPOINTS,
  BreakpointName,
  hasHorizontalScroll,
  undersizedTargets,
} from '../../pages/viewport';

for (const name of Object.keys(BREAKPOINTS) as BreakpointName[]) {
  test(`the events list fits and keeps 24px targets at ${name}`, async ({ page, api }) => {
    await page.setViewportSize(BREAKPOINTS[name]);
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['EventLead'] });
    const builders = api.events.add({
      title: 'Hackathon: Tech for Shelters, a weekend of building for the city',
      type: 'Hackathon',
      venue: 'Trinity Community Centre, 155 Crawford St',
    });
    api.events.addRsvps(builders, 52);

    await api.signInAs(grace, '/events');
    const events = new EventsPage(page);
    await expect(events.events).toHaveCount(1);
    expect(await hasHorizontalScroll(page), 'events').toBe(false);
    expect(await undersizedTargets(page), 'events').toEqual([]);
  });
}
