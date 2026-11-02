import { expect, test } from '../../../e2e/fixtures/app';
import { EventHubPage } from '../../../e2e/pages/event-hub.page';
import { HubPage } from '../../../e2e/pages/hub.page';
import {
  MoveHubSessionDialog,
  PostHubUpdateDialog,
  SwapHubLinkDialog,
} from '../../../e2e/pages/hub-quick-edit.dialogs';
import { Presenter } from '../presenter';

test.use({ timezoneId: 'America/Toronto' });

// Viewports are capped at the video's 720px height, so the phone frame is not scaled.
const PHONE = { width: 390, height: 720 };
const DESKTOP = { width: 1280, height: 720 };
const UPDATE = 'Dinner has moved to the courtyard. Demos start at 8:30 pm.';

// Journey: run the day from a phone (docs/detailed-designs/events/run-the-day-from-a-phone, L2-188 to L2-192).
test('run-the-day-from-a-phone', async ({ page, api }) => {
  const show = await Presenter.start(page, 'run-the-day-from-a-phone');
  const home = new EventHubPage(page);
  const hub = new HubPage(page);
  const event = api.events.add({
    title: 'Toronto Builders Night',
    startsAt: '2026-11-06T23:30:00.000Z',
    endsAt: '2026-11-07T02:00:00.000Z',
    venue: 'Kestrel Labs, 220 King St W, Toronto',
    visibility: 'Public',
  });
  api.events.hubs.add(event);
  const at = (minutes: number) =>
    new Date(Date.parse(event.startsAt) + minutes * 60_000).toISOString();
  api.events.hubs.fill(event.id, 'Agenda', {
    items: [
      { startsAt: at(0), title: 'Doors open', detail: null },
      { startsAt: at(30), title: 'Build time', detail: null },
      { startsAt: at(90), title: 'Code freeze', detail: null },
      { startsAt: at(105), title: 'Demos and feedback', detail: null },
      { startsAt: at(135), title: 'Wrap up and prayer', detail: null },
    ],
  });
  api.events.hubs.fill(event.id, 'Links', {
    submissionUrl: 'https://forms.faithtech.com/toronto-builders-night/submit',
    feedbackUrl: 'https://forms.faithtech.com/toronto-builders-night/feedback',
    codeFreezeAt: at(90),
  });
  api.events.hubs.publish(event.id);
  const grace = api.addAccount({
    email: 'grace@example.org',
    name: 'Grace Okonkwo',
    roles: ['CityLead'],
  });

  await show.card(
    'opening',
    'opening',
    ['Run the day from a phone', 'Recorded against a local fake API · synthetic people and events'],
    () => api.signInAs(grace, `/events/${event.id}/hub`),
  );

  await show.step(
    'home',
    async () => {
      await page.setViewportSize(PHONE);
      await expect(home.quickEdits).toBeVisible();
    },
    { poster: true, position: 'top' },
  );

  await show.step(
    'update',
    async () => {
      await home.postUpdate.click();
      const dialog = new PostHubUpdateDialog(page);
      await dialog.text.pressSequentially(UPDATE, { delay: 40 });
      await dialog.post.click();
      await expect(home.toast('Update posted')).toBeVisible();
      await expect(home.liveUpdate).toHaveText(UPDATE);
    },
    { position: 'top' },
  );

  await show.step(
    'move',
    async () => {
      await home.moveSession.click();
      const dialog = new MoveHubSessionDialog(page);
      await dialog.session.selectOption({ label: '8:00 pm · Code freeze' });
      await dialog.time.fill('20:30');
      await expect(dialog.shiftLater).toBeChecked();
    },
    { position: 'top' },
  );

  await show.step(
    'moved',
    async () => {
      await new MoveHubSessionDialog(page).move.click();
      await expect(home.toast('Session moved')).toBeVisible();
    },
    { position: 'top' },
  );

  await show.step(
    'swap',
    async () => {
      await home.swapLink.click();
      const dialog = new SwapHubLinkDialog(page);
      await dialog.link.fill('');
      await dialog.link.pressSequentially(
        'https://forms.faithtech.com/toronto-builders-night/submit-v2',
        { delay: 20 },
      );
      await dialog.swap.click();
      await expect(home.toast('Link swapped')).toBeVisible();
    },
    { position: 'top' },
  );

  await show.step(
    'hub',
    async () => {
      await hub.open(event.id);
      await expect(hub.update).toContainText(UPDATE);
      await expect(hub.agendaRow('Code freeze')).toContainText('8:30');
    },
    { position: 'top' },
  );

  await show.step(
    'live',
    async () => {
      await hub.setTabVisible(false);
      api.events.hubs.setUpdate(event.id, 'Demos are starting now in the main room.');
      await hub.setTabVisible(true);
      await expect(hub.update).toContainText('Demos are starting now in the main room.');
    },
    { position: 'top' },
  );

  await page.setViewportSize(DESKTOP);
  await show.card('closing', 'closing', [
    'Quick edits on the hub home',
    'Changes go live at once',
    'Open hubs catch up within 30 seconds',
  ]);
  await show.finish();
});
