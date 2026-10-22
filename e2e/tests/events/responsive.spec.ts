// Traces to: L2-020, L2-021 with L2-045 AC1 (docs/detailed-designs/platform/responsive-layout-and-theming)
import { expect, test } from '../../fixtures/app';
import { EventFormPage } from '../../pages/event-form.page';
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

for (const name of Object.keys(BREAKPOINTS) as BreakpointName[]) {
  test(`the event form fits and keeps 24px targets at ${name}`, async ({ page, api }) => {
    await page.setViewportSize(BREAKPOINTS[name]);
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['EventLead'] });

    await api.signInAs(grace, '/events/new');
    const form = new EventFormPage(page);
    await expect(form.publish).toBeVisible();
    await form.publish.click();
    await expect(form.summary).toBeVisible();
    expect(await hasHorizontalScroll(page), 'event form').toBe(false);
    expect(await undersizedTargets(page), 'event form').toEqual([]);
  });
}
