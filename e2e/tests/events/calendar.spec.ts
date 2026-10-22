// Traces to: L2-024 (docs/detailed-designs/events/calendar-export)
import { Download, Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

import { expect, test } from '../../fixtures/app';
import { EventFormPage } from '../../pages/event-form.page';
import { EventPage } from '../../pages/event.page';
import { PublicEventPage } from '../../pages/public-event.page';

test.use({ timezoneId: 'America/Toronto' });

/** Runs `action`, waits for the download it starts and returns the file's name and unfolded lines. */
async function download(page: Page, action: () => Promise<void>) {
  const [file] = await Promise.all([page.waitForEvent('download'), action()]);
  return { name: file.suggestedFilename(), lines: await linesOf(file) };
}

async function linesOf(file: Download): Promise<string[]> {
  return (await readFile((await file.path())!, 'utf8')).replace(/\r\n /g, '').split('\r\n');
}

test.describe('Calendar export', () => {
  test('a member downloads the .ics; after an edit and a cancellation it carries a higher sequence', async ({
    page,
    api,
  }) => {
    const event = api.events.add({
      title: 'Toronto Builders Night',
      startsAt: '2026-11-06T23:30:00.000Z',
      endsAt: '2026-11-07T02:00:00.000Z',
    });
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['EventLead'] });
    const eventPage = new EventPage(page);
    await api.signInAs(grace, `/events/${event.id}`);

    const first = await download(page, () => eventPage.addToCalendar.click());
    expect(first.name).toBe('toronto-builders-night.ics');
    expect(first.lines).toEqual(
      expect.arrayContaining([
        'BEGIN:VCALENDAR',
        `UID:${event.id}@faithtech.community`,
        'DTSTART:20261106T233000Z',
        'DTEND:20261107T020000Z',
        'SUMMARY:Toronto Builders Night',
        'LOCATION:Kestrel Labs, 220 King St W, Toronto',
        'SEQUENCE:0',
        'STATUS:CONFIRMED',
      ]),
    );

    const form = new EventFormPage(page);
    await form.openEdit(event.id);
    await form.fill({ venue: 'Trinity Community Centre' });
    await form.saveChanges.click();
    await expect(eventPage.heading).toHaveText('Toronto Builders Night');
    const changed = await download(page, () => eventPage.addToCalendar.click());
    expect(changed.lines).toContain('SEQUENCE:1');
    expect(changed.lines).toContain('LOCATION:Trinity Community Centre, Toronto');

    event.isCancelled = true;
    event.sequence++;
    await eventPage.open(event.id);
    const cancelled = await download(page, () => eventPage.updateCalendar.click());
    expect(cancelled.lines).toEqual(
      expect.arrayContaining([
        `UID:${event.id}@faithtech.community`,
        'SEQUENCE:2',
        'STATUS:CANCELLED',
      ]),
    );
  });

  test('anyone downloads a public event’s .ics from its share page', async ({ page, api }) => {
    const event = api.events.add({
      title: 'Prayer & Planning',
      format: 'Online',
      venue: null,
      onlineLink: 'https://meet.example.org/ft',
      visibility: 'Public',
    });
    const publicPage = new PublicEventPage(page);
    await publicPage.open(event.id);

    const file = await download(page, () => publicPage.addToCalendar.click());

    expect(file.name).toBe('prayer-planning.ics');
    expect(file.lines).toContain(`UID:${event.id}@faithtech.community`);
    expect(file.lines).toContain(`URL:/public/events/${event.id}`);
    expect(file.lines.join('\n')).not.toContain('meet.example.org');
  });
});
