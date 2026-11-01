// Traces to: L2-156 AC1, AC5; L2-157 AC1 to AC4, AC8; L2-158 AC1 to AC3, AC5
// (docs/detailed-designs/events/fill-in-hub-sections)
import { expect, test } from '../../fixtures/app';
import { MockApi } from '../../fixtures/mock-api';
import { EventHubPage } from '../../pages/event-hub.page';
import { HubSectionPreviewDialog } from '../../pages/hub-section-preview.dialog';
import { HubSectionDialog } from '../../pages/hub-section.dialog';
import { BREAKPOINTS, hasHorizontalScroll } from '../../pages/viewport';

test.use({ timezoneId: 'America/Toronto' });

function arrange(api: MockApi) {
  const event = api.events.add({
    title: 'Toronto Builders Night',
    startsAt: '2026-11-06T23:30:00.000Z',
    endsAt: '2026-11-07T02:00:00.000Z',
    format: 'InPerson',
    venue: 'Kestrel Labs, 220 King St W, Toronto',
    visibility: 'Public',
  });
  api.events.hubs.add(event);
  const grace = api.addAccount({
    email: 'grace@example.org',
    name: 'Grace Okonkwo',
    roles: ['CityLead'],
  });
  return { event, grace };
}

test.describe('Hub sections: Hero and Giving', () => {
  // L2-157 AC1 to AC3, L2-158 AC1, AC2, L2-156 AC5.
  test('a lead adds a subtitle to the Hero and previews it', async ({ page, api, axe }) => {
    const { event, grace } = arrange(api);
    const hub = new EventHubPage(page);
    const hero = new HubSectionDialog(page, 'Hero');
    await api.signInAs(grace, `/events/${event.id}/hub`);

    await hub.action('Edit', 'Hero').click();
    await expect(hero.question).toHaveText('What should the top of the hub say?');
    await expect(hero.fact('Title')).toHaveText('Toronto Builders Night');
    await expect(hero.fact('When')).toHaveText('Fri 6 Nov 2026 · 6:30 – 9:00 pm');
    await expect(hero.fact('Where')).toHaveText('Kestrel Labs, 220 King St W, Toronto');
    await expect(hero.fact('RSVP button')).toHaveText('Links to the RSVP page');
    await axe.check();

    await hero.field('Subtitle').fill('x'.repeat(141));
    await hero.save.click();
    await expect(hero.text('Use 140 characters or fewer.')).toBeVisible();
    expect(api.callsTo('PUT', `/api/events/${event.id}/hub/sections/Hero`)).toHaveLength(0);

    await hero.field('Subtitle').fill('A night of building for the city');
    await hero.save.click();
    await expect(hub.toast('Hero saved')).toBeVisible();
    await expect(hero.dialog).toHaveCount(0);
    expect(api.events.hubs.section(event.id, 'Hero')?.content).toEqual({
      subtitle: 'A night of building for the city',
    });

    await hub.more('Hero').click();
    await hub.menuItem('Preview').click();
    const preview = new HubSectionPreviewDialog(page, 'Hero');
    await expect(preview.heading('Toronto Builders Night')).toBeVisible();
    await expect(preview.text('A night of building for the city')).toBeVisible();
    await expect(preview.text('FaithTech Community')).toBeVisible();
    await expect(preview.link('RSVP')).toHaveAttribute(
      'href',
      new RegExp(`/public/events/${event.id}$`),
    );
    await axe.check();

    await preview.edit.click();
    await expect(hero.field('Subtitle')).toHaveValue('A night of building for the city');
  });

  // L2-157 AC4: a failed save keeps the input and Try again saves it.
  test('a failed save keeps what was typed and Try again saves it', async ({ page, api, axe }) => {
    const { event, grace } = arrange(api);
    const hub = new EventHubPage(page);
    const hero = new HubSectionDialog(page, 'Hero');
    await api.signInAs(grace, `/events/${event.id}/hub`);

    await hub.action('Edit', 'Hero').click();
    await hero.field('Subtitle').fill('A night of building');
    api.events.hubs.failNextSave();
    await hero.save.click();

    await expect(hero.failed).toBeVisible();
    await expect(hero.field('Subtitle')).toHaveValue('A night of building');
    await axe.check();

    await hero.tryAgain.click();
    await expect(hub.toast('Hero saved')).toBeVisible();
    expect(api.events.hubs.section(event.id, 'Hero')?.content).toEqual({
      subtitle: 'A night of building',
    });
  });

  // L2-158 AC3: the event line; the giving link and text come from Organisation settings.
  test('a lead adds the event line to Giving', async ({ page, api, axe }) => {
    const { event, grace } = arrange(api);
    const hub = new EventHubPage(page);
    const giving = new HubSectionDialog(page, 'Giving');
    await api.signInAs(grace, `/events/${event.id}/hub`);

    await hub.action('Edit', 'Giving').click();
    await expect(giving.question).toHaveText('Anything to add for this event?');
    await expect(giving.fact('Giving link')).toHaveText('https://faithtech.com/donate');
    await expect(giving.fact('Giving text')).toHaveText('Help us build the next one.');
    await axe.check();

    await giving.field('Event line').fill('Tonight’s gifts fund the Toronto shelters build.');
    await giving.save.click();
    await expect(hub.toast('Giving saved')).toBeVisible();

    await hub.more('Giving').click();
    await hub.menuItem('Preview').click();
    const preview = new HubSectionPreviewDialog(page, 'Giving');
    await expect(preview.text('Tonight’s gifts fund the Toronto shelters build.')).toBeVisible();
    await expect(preview.text('Help us build the next one.')).toBeVisible();
    await expect(preview.link(/^Give/)).toHaveAttribute('href', 'https://faithtech.com/donate');
  });

  // L2-158 AC5: without the organisation's giving link the wizard says where to add it.
  test('Giving says where to add a missing giving link', async ({ page, api }) => {
    const { event, grace } = arrange(api);
    api.host.organisation = { ...api.host.organisation, givingLink: null, givingText: null };
    const hub = new EventHubPage(page);
    const giving = new HubSectionDialog(page, 'Giving');
    await api.signInAs(grace, `/events/${event.id}/hub`);

    await hub.action('Fill in', 'Giving').click();
    await expect(
      giving.text(
        'FaithTech hasn’t added a giving link yet. Add one in Organisation settings, General.',
      ),
    ).toBeVisible();
    await giving.save.click();
    await expect(hub.toast('Giving saved')).toBeVisible();
    await expect(hub.row('Giving')).toContainText('Needs info');
  });

  // L2-157 AC8.
  test('the Hero wizard fits a phone', async ({ page, api }) => {
    const { event, grace } = arrange(api);
    await page.setViewportSize(BREAKPOINTS.xs);
    const hub = new EventHubPage(page);
    const hero = new HubSectionDialog(page, 'Hero');
    await api.signInAs(grace, `/events/${event.id}/hub`);

    await hub.action('Edit', 'Hero').click();
    await expect(hero.question).toBeVisible();
    expect(await hasHorizontalScroll(page)).toBe(false);
  });
});
