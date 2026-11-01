// Traces to: L2-156 AC2, L2-157 AC2, L2-160 AC1 to AC4 (docs/detailed-designs/events/fill-in-hub-sections)
import { expect, test } from '../../fixtures/app';
import { MockApi } from '../../fixtures/mock-api';
import { EventHubPage } from '../../pages/event-hub.page';
import { HubSectionPreviewDialog } from '../../pages/hub-section-preview.dialog';
import { HubSectionDialog } from '../../pages/hub-section.dialog';

test.use({ timezoneId: 'America/Toronto' });

const VENUE = 'Kestrel Labs, 220 King St W, Toronto';

function arrange(api: MockApi, format: 'InPerson' | 'Online' = 'InPerson') {
  const event = api.events.add({
    title: 'Toronto Builders Night',
    startsAt: '2026-11-06T23:30:00.000Z',
    endsAt: '2026-11-07T02:00:00.000Z',
    format,
    venue: format === 'InPerson' ? VENUE : null,
    onlineLink: format === 'Online' ? 'https://meet.example.org/builders' : null,
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

test.describe('Hub sections: Venue and Submission and feedback', () => {
  // L2-160 AC1, AC2.
  test('a lead adds directions to the Venue and previews it', async ({ page, api, axe }) => {
    const { event, grace } = arrange(api);
    const hub = new EventHubPage(page);
    const venue = new HubSectionDialog(page, 'Venue');
    await api.signInAs(grace, `/events/${event.id}/hub`);

    await hub.action('Edit', 'Venue').click();
    await expect(venue.question).toHaveText('How do people find it?');
    await expect(venue.fact('Venue')).toHaveText(VENUE);
    await expect(venue.link(/^Open in maps/)).toHaveAttribute(
      'href',
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(VENUE)}`,
    );
    await axe.check();

    await venue.field('Directions').fill('Enter from Spadina; we’re on the 4th floor.');
    await venue.save.click();
    await expect(hub.toast('Venue saved')).toBeVisible();
    expect(api.events.hubs.section(event.id, 'Venue')?.content).toEqual({
      directions: 'Enter from Spadina; we’re on the 4th floor.',
    });

    await hub.more('Venue').click();
    await hub.menuItem('Preview').click();
    const preview = new HubSectionPreviewDialog(page, 'Venue');
    await expect(preview.heading('Where')).toBeVisible();
    await expect(preview.text('Enter from Spadina; we’re on the 4th floor.')).toBeVisible();
    await expect(preview.link(/^Open in maps/)).toBeVisible();
  });

  // L2-160 AC1, L2-156 AC2: an online event has no venue to fill in.
  test('an online event’s Venue says the hub shows the joining link', async ({ page, api }) => {
    const { event, grace } = arrange(api, 'Online');
    const hub = new EventHubPage(page);
    const venue = new HubSectionDialog(page, 'Venue');
    await api.signInAs(grace, `/events/${event.id}/hub`);

    await expect(hub.line('Venue')).toHaveText('Add a venue to the event.');
    await hub.action('Fill in', 'Venue').click();
    await expect(
      venue.text('This event is online, so the hub shows the joining link instead of a venue.'),
    ).toBeVisible();
    await expect(venue.save).toHaveCount(0);
    await venue.button('Close').last().click();
    await expect(venue.dialog).toHaveCount(0);
  });

  // L2-160 AC3: links are https only; without an agenda there is no code freeze to pick.
  test('a lead adds the submission and feedback links', async ({ page, api, axe }) => {
    const { event, grace } = arrange(api);
    const hub = new EventHubPage(page);
    const links = new HubSectionDialog(page, 'Submission and feedback');
    await api.signInAs(grace, `/events/${event.id}/hub`);

    await hub.action('Fill in', 'Submission and feedback').click();
    await expect(links.question).toHaveText(
      'Where do teams submit, and where do people give feedback?',
    );
    await expect(links.select('Code freeze')).toBeDisabled();
    await expect(links.text('Add an agenda first to pick a code-freeze time.')).toBeVisible();
    await axe.check();

    await links.field('Submission link').fill('forms.faithtech.com/submit');
    await links.save.click();
    await expect(links.text('Use a link that starts with https://')).toBeVisible();
    expect(api.callsTo('PUT', `/api/events/${event.id}/hub/sections/Links`)).toHaveLength(0);

    await links.field('Submission link').fill('https://forms.faithtech.com/submit');
    await links.field('Feedback link').fill('https://forms.faithtech.com/feedback');
    await links.save.click();
    await expect(hub.toast('Submission and feedback saved')).toBeVisible();
    await expect(hub.row('Submission and feedback')).toContainText('Ready');
  });

  // L2-160 AC3, AC4: the code freeze is one of the agenda's rows.
  test('a lead picks the code freeze from the agenda and previews it', async ({ page, api }) => {
    const { event, grace } = arrange(api);
    api.events.hubs.fill(event.id, 'Agenda', {
      items: [
        { startsAt: '2026-11-06T23:30:00.000Z', title: 'Doors open', detail: null },
        { startsAt: '2026-11-07T01:00:00.000Z', title: 'Code freeze', detail: null },
      ],
    });
    const hub = new EventHubPage(page);
    const links = new HubSectionDialog(page, 'Submission and feedback');
    await api.signInAs(grace, `/events/${event.id}/hub`);

    await hub.action('Fill in', 'Submission and feedback').click();
    await links.field('Submission link').fill('https://forms.faithtech.com/submit');
    await links.select('Code freeze').selectOption({ label: '8:00 pm Code freeze' });
    await links.save.click();
    await expect(hub.toast('Submission and feedback saved')).toBeVisible();
    expect(api.events.hubs.section(event.id, 'Links')?.content).toEqual({
      submissionUrl: 'https://forms.faithtech.com/submit',
      feedbackUrl: null,
      codeFreezeAt: '2026-11-07T01:00:00.000Z',
    });

    await hub.more('Submission and feedback').click();
    await hub.menuItem('Preview').click();
    const preview = new HubSectionPreviewDialog(page, 'Submission and feedback');
    await expect(preview.link(/^Submit your project/)).toHaveAttribute(
      'href',
      'https://forms.faithtech.com/submit',
    );
    await expect(preview.link(/^Give feedback/)).toHaveCount(0);
    await expect(preview.text('Code freeze at 8:00 pm')).toBeVisible();
  });
});
