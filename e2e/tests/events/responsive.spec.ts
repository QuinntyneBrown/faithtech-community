// Traces to: L2-020, L2-021, L2-022 with L2-045 AC1 (docs/detailed-designs/platform/responsive-layout-and-theming)
import { expect, test } from '../../fixtures/app';
import { EventFormPage } from '../../pages/event-form.page';
import { EventPage } from '../../pages/event.page';
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

for (const name of Object.keys(BREAKPOINTS) as BreakpointName[]) {
  test(`the event page with its RSVP list fits and keeps 24px targets at ${name}`, async ({
    page,
    api,
  }) => {
    await page.setViewportSize(BREAKPOINTS[name]);
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const event = api.events.add({ title: 'Hackathon: Tech for Shelters, a weekend of building' });
    api.events.addGuest(event, 'Abby Brooks', 'abby.brooks.with.a.long.address@example.org');
    api.events.addRsvps(event, 3);

    await api.signInAs(grace, `/events/${event.id}`);
    const eventPage = new EventPage(page);
    await expect(eventPage.rsvpList).toHaveCount(4);
    expect(await hasHorizontalScroll(page), 'event').toBe(false);
    expect(await undersizedTargets(page), 'event').toEqual([]);
  });
}
