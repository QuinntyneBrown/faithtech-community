import { expect, test } from '../../../e2e/fixtures/app';
import { EventHubPage } from '../../../e2e/pages/event-hub.page';
import { HubAgendaDialog } from '../../../e2e/pages/hub-agenda.dialog';
import { HubPeopleDialog } from '../../../e2e/pages/hub-people.dialog';
import { HubSectionPreviewDialog } from '../../../e2e/pages/hub-section-preview.dialog';
import { HubSectionDialog } from '../../../e2e/pages/hub-section.dialog';
import { Presenter } from '../presenter';

test.use({ timezoneId: 'America/Toronto' });

// Journey: fill in hub sections (docs/detailed-designs/events/fill-in-hub-sections, L2-155 to L2-162).
test('fill-in-hub-sections', async ({ page, api }) => {
  const show = await Presenter.start(page, 'fill-in-hub-sections');
  const hub = new EventHubPage(page);
  const hero = new HubSectionDialog(page, 'Hero');
  const agenda = new HubAgendaDialog(page);
  const venue = new HubSectionDialog(page, 'Venue');
  const people = new HubPeopleDialog(page);
  const links = new HubSectionDialog(page, 'Submission and feedback');
  const event = api.events.add({
    title: 'Toronto Builders Night',
    startsAt: '2026-11-06T23:30:00.000Z',
    endsAt: '2026-11-07T02:00:00.000Z',
    venue: 'Kestrel Labs, 220 King St W, Toronto',
    visibility: 'Public',
  });
  api.events.hubs.add(event);
  const grace = api.addAccount({
    email: 'grace@example.org',
    name: 'Grace Okonkwo',
    roles: ['CityLead'],
  });
  api.addAccount({
    email: 'hannah@example.org',
    name: 'Hannah Kim',
    roles: ['CommunicationsLead'],
  });
  api.addAccount({
    email: 'samuel@example.org',
    name: 'Samuel Mensah',
    roles: ['ProductEngineer'],
  });

  await show.card(
    'opening',
    'opening',
    ['Fill in an event hub', 'Recorded against a local fake API · synthetic people and events'],
    () => api.signInAs(grace, `/events/${event.id}/hub`),
  );

  await show.step('checklist', async () => {
    await expect(hub.heading).toHaveText('Event hub');
  });

  await show.step('hero', async () => {
    await hub.action('Edit', 'Hero').click();
    await hero.field('Subtitle').fill('A night of building for the city');
  });

  await show.step('hero-saved', async () => {
    await hero.save.click();
    await expect(hub.toast('Hero saved')).toBeVisible();
  });

  await show.step('agenda-paste', async () => {
    await hub.action('Fill in', 'Agenda').click();
    await agenda.pasteSchedule.click();
    await agenda.schedule.fill(
      '6:30 Doors open\n7:00 Build time\n8:00 Code freeze\n8:15 Demos and feedback\n9:00 Wrap up and prayer\nspeakers to be confirmed',
    );
    await agenda.readSchedule.click();
    await expect(agenda.found).toBeVisible();
  });

  await show.step('agenda-rows', async () => {
    await agenda.addTheseRows.click();
    await expect(agenda.rows).toHaveCount(5);
  });

  await show.step(
    'agenda-review',
    async () => {
      await agenda.next.click();
      await expect(agenda.step).toHaveText(/Step 2 of 2\s*Review/);
    },
    { poster: true },
  );

  await show.step('agenda-saved', async () => {
    await agenda.save.click();
    await expect(hub.toast('Agenda saved')).toBeVisible();
  });

  await show.step('venue', async () => {
    await hub.action('Edit', 'Venue').click();
    await venue.field('Directions').fill('Enter from Spadina; we’re on the 4th floor.');
    await venue.save.click();
    await expect(hub.toast('Venue saved')).toBeVisible();
  });

  await show.step('people', async () => {
    await hub.action('Fill in', 'People').click();
    await people.addMember('Hann', 'Hannah Kim');
    await people.roleOf('Hannah Kim').selectOption('Speaker');
    await people.addMember('Sam', 'Samuel Mensah');
  });

  await show.step('guest', async () => {
    await people.addGuest.click();
    await people.guestName.fill('Nadia Farouk');
    await people.guestAbout.fill('Founder, Kestrel Labs');
    await people.guestRole.selectOption('Judge');
    await people.addGuestConfirm.click();
    await expect(people.person('Nadia Farouk')).toBeVisible();
  });

  await show.step('people-review', async () => {
    await people.next.click();
    await expect(people.group('Judges')).toBeVisible();
    await people.save.click();
    await expect(hub.toast('People saved')).toBeVisible();
  });

  await show.step('links', async () => {
    await hub.action('Fill in', 'Submission and feedback').click();
    await links.field('Submission link').fill('https://forms.faithtech.com/submit');
    await links.select('Code freeze').selectOption({ label: '8:00 pm Code freeze' });
    await links.save.click();
    await expect(hub.toast('Submission and feedback saved')).toBeVisible();
  });

  await show.step('preview', async () => {
    await hub.more('Agenda').click();
    await hub.menuItem('Preview').click();
    await expect(new HubSectionPreviewDialog(page, 'Agenda').heading('Agenda')).toBeVisible();
  });

  await show.card('closing', 'closing', [
    'One short wizard per section',
    'Saved as you go',
    'Preview any section as visitors will see it',
  ]);
  await show.finish();
});
