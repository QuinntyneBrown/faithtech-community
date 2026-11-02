// Traces to: L2-188, L2-189, L2-190, L2-191, L2-192 (docs/detailed-designs/events/run-the-day-from-a-phone)
import { expect, test } from '../../fixtures/app';
import { MockApi } from '../../fixtures/mock-api';
import { EventHubPage } from '../../pages/event-hub.page';
import { HubPage } from '../../pages/hub.page';
import { MoveHubSessionDialog, PostHubUpdateDialog } from '../../pages/hub-quick-edit.dialogs';
import { hasHorizontalScroll } from '../../pages/viewport';

test.use({ timezoneId: 'America/Toronto', viewport: { width: 360, height: 780 } });

const UPDATE = 'Dinner has moved to the courtyard. Demos start at 8:45 pm.';

/** Toronto Builders Night with a published hub, and Grace, a City Lead who manages hubs. */
function arrange(api: MockApi) {
  const event = api.events.add({
    title: 'Toronto Builders Night',
    startsAt: '2026-11-06T23:30:00.000Z',
    endsAt: '2026-11-07T02:00:00.000Z',
    venue: 'Kestrel Labs, 220 King St W, Toronto',
    visibility: 'Public',
  });
  api.events.hubs.add(event);
  api.events.hubs.publish(event.id);
  const grace = api.addAccount({
    email: 'grace@example.org',
    name: 'Grace Okonkwo',
    roles: ['CityLead'],
  });
  return { event, grace };
}

test.describe('Run the day from a phone: the update', () => {
  // L2-188 AC1, AC4, L2-189 AC1, AC3, AC5: on a phone a lead posts an update and the hub shows it first.
  test('a lead posts an update from a phone and the hub shows it at the top', async ({
    page,
    api,
    axe,
  }) => {
    const { event, grace } = arrange(api);
    const home = new EventHubPage(page);
    const dialog = new PostHubUpdateDialog(page);
    const hub = new HubPage(page);
    await api.signInAs(grace, `/events/${event.id}/hub`);

    await expect(home.quickEdits).toBeVisible();
    await expect(home.quickEdits.getByText('Changes show on the hub at once.')).toBeVisible();
    for (const size of await home.quickEditSizes()) {
      expect(size.height).toBeGreaterThanOrEqual(44);
      expect(size.width).toBeGreaterThan(size.card * 0.8);
    }
    expect(await hasHorizontalScroll(page)).toBe(false);
    await axe.check();

    await home.postUpdate.click();
    await expect(dialog.text).toBeFocused();
    await expect(dialog.dialog.getByText('280 characters left')).toBeVisible();
    await axe.check();
    await dialog.text.fill(`  ${UPDATE}  `);
    await dialog.post.click();

    await expect(dialog.dialog).toBeHidden();
    await expect(home.toast('Update posted')).toBeVisible();
    await expect(home.liveUpdate).toHaveText(UPDATE);
    await expect(home.postUpdate).toBeHidden();
    await axe.check();

    await hub.open(event.id);
    await expect(hub.update).toContainText(UPDATE);
    await expect(hub.update).toHaveAttribute('role', 'status');
    await axe.check();
  });

  // L2-189 AC5: an anonymous visitor sees the update on a public hub.
  test('an anonymous visitor sees the update on a public hub', async ({ page, api }) => {
    const { event } = arrange(api);
    api.events.hubs.setUpdate(event.id, UPDATE);
    const hub = new HubPage(page);

    await hub.open(event.id);

    await expect(hub.update).toContainText(UPDATE);
    await expect(hub.sectionHeadings.first()).toHaveText('Toronto Builders Night');
  });

  // L2-189 AC2, AC3: an empty update is refused on the field; a failed save keeps the text and offers Try again.
  test('an empty update is refused and a failed post keeps the text', async ({ page, api }) => {
    const { event, grace } = arrange(api);
    const home = new EventHubPage(page);
    const dialog = new PostHubUpdateDialog(page);
    await api.signInAs(grace, `/events/${event.id}/hub`);

    await home.postUpdate.click();
    await dialog.post.click();
    await expect(dialog.error('Write the update.')).toBeVisible();

    api.events.hubs.failNextQuickEdit();
    await dialog.text.fill(UPDATE);
    await dialog.post.click();
    await expect(dialog.failed).toBeVisible();
    await expect(dialog.text).toHaveValue(UPDATE);

    await dialog.tryAgain.click();
    await expect(dialog.dialog).toBeHidden();
    await expect(home.liveUpdate).toHaveText(UPDATE);
  });

  // L2-188 AC2, L2-189 AC1, AC4: Change starts from the live text; Clear update removes it in one tap.
  test('a lead changes the update and then clears it with one tap', async ({ page, api }) => {
    const { event, grace } = arrange(api);
    api.events.hubs.setUpdate(event.id, 'Doors open at 6:45 pm.');
    const home = new EventHubPage(page);
    const dialog = new PostHubUpdateDialog(page);
    const hub = new HubPage(page);
    await api.signInAs(grace, `/events/${event.id}/hub`);

    await home.changeUpdate.click();
    await expect(dialog.text).toHaveValue('Doors open at 6:45 pm.');
    await dialog.text.fill('Doors open at 7:00 pm.');
    await dialog.post.click();
    await expect(home.liveUpdate).toHaveText('Doors open at 7:00 pm.');

    await home.clearUpdate.click();

    await expect(home.toast('Update cleared')).toBeVisible();
    await expect(home.postUpdate).toBeVisible();
    await hub.open(event.id);
    await expect(hub.sectionHeadings.first()).toHaveText('Toronto Builders Night');
    await expect(hub.update).toHaveCount(0);
  });
});

/** The evening's five rows, from 6:30 pm Toronto time, with the code freeze at 8:00 pm. */
function fillAgenda(api: MockApi, eventId: string) {
  const at = (minutes: number) =>
    new Date(Date.parse('2026-11-06T23:30:00.000Z') + minutes * 60_000).toISOString();
  api.events.hubs.fill(eventId, 'Agenda', {
    items: [
      { startsAt: at(0), title: 'Doors open', detail: null },
      { startsAt: at(30), title: 'Build time', detail: null },
      { startsAt: at(90), title: 'Code freeze', detail: null },
      { startsAt: at(105), title: 'Demos and feedback', detail: null },
      { startsAt: at(135), title: 'Wrap up and prayer', detail: null },
    ],
  });
  api.events.hubs.fill(eventId, 'Links', {
    submissionUrl: 'https://forms.faithtech.com/toronto-builders-night/submit',
    feedbackUrl: 'https://forms.faithtech.com/toronto-builders-night/feedback',
    codeFreezeAt: at(90),
  });
}

test.describe('Run the day from a phone: move a session', () => {
  // L2-190 AC1 to AC3, L2-188 AC4: on a phone a lead moves Code freeze 30 minutes later and the later sessions follow.
  test('a lead moves a session and the later sessions follow', async ({ page, api, axe }) => {
    const { event, grace } = arrange(api);
    fillAgenda(api, event.id);
    const home = new EventHubPage(page);
    const dialog = new MoveHubSessionDialog(page);
    const hub = new HubPage(page);
    await api.signInAs(grace, `/events/${event.id}/hub`);

    await home.moveSession.click();
    await expect(dialog.session).toHaveValue('0');
    await expect(dialog.time).toHaveValue('18:30');
    await expect(dialog.shiftLater).toHaveCount(0);
    await dialog.session.selectOption({ label: '8:00 pm · Code freeze' });
    await expect(dialog.time).toHaveValue('20:00');
    await dialog.time.fill('20:30');
    await expect(dialog.shiftLater).toBeChecked();
    await expect(
      dialog.dialog.getByText('Also move the 2 later sessions 30 minutes later'),
    ).toBeVisible();
    expect(await hasHorizontalScroll(page)).toBe(false);
    await axe.check();
    await dialog.move.click();

    await expect(dialog.dialog).toBeHidden();
    await expect(home.toast('Session moved')).toBeVisible();
    await hub.open(event.id);
    await expect(hub.agendaRow('Build time')).toContainText('7:00');
    await expect(hub.agendaRow('Code freeze')).toContainText('8:30');
    await expect(hub.agendaRow('Demos and feedback')).toContainText('8:45');
    await expect(hub.agendaRow('Wrap up and prayer')).toContainText('9:15');
  });

  // L2-190 AC2, AC3: unticking the offer moves only the chosen session.
  test('unticking the offer moves only the chosen session', async ({ page, api }) => {
    const { event, grace } = arrange(api);
    fillAgenda(api, event.id);
    const home = new EventHubPage(page);
    const dialog = new MoveHubSessionDialog(page);
    const hub = new HubPage(page);
    await api.signInAs(grace, `/events/${event.id}/hub`);

    await home.moveSession.click();
    await dialog.session.selectOption({ label: '7:00 pm · Build time' });
    await dialog.time.fill('18:45');
    await expect(
      dialog.dialog.getByText('Also move the 3 later sessions 15 minutes earlier'),
    ).toBeVisible();
    await dialog.shiftLater.uncheck();
    await dialog.move.click();
    await expect(home.toast('Session moved')).toBeVisible();

    await hub.open(event.id);
    await expect(hub.agendaRow('Build time')).toContainText('6:45');
    await expect(hub.agendaRow('Code freeze')).toContainText('8:00');
  });

  // L2-190 AC4: no time is refused on the field; a failed move keeps the choice and offers Try again.
  test('a move without a time is refused and a failed move keeps the choice', async ({
    page,
    api,
  }) => {
    const { event, grace } = arrange(api);
    fillAgenda(api, event.id);
    const home = new EventHubPage(page);
    const dialog = new MoveHubSessionDialog(page);
    await api.signInAs(grace, `/events/${event.id}/hub`);

    await home.moveSession.click();
    await dialog.time.fill('');
    await dialog.move.click();
    await expect(dialog.error('Enter a time.')).toBeVisible();

    api.events.hubs.failNextQuickEdit();
    await dialog.time.fill('19:00');
    await dialog.move.click();
    await expect(dialog.failed).toBeVisible();
    await expect(dialog.time).toHaveValue('19:00');
    await dialog.tryAgain.click();
    await expect(dialog.dialog).toBeHidden();
    await expect(home.toast('Session moved')).toBeVisible();
  });

  // L2-188 AC3: with no agenda rows there is nothing to move.
  test('a hub without agenda rows offers no Move a session', async ({ page, api }) => {
    const { event, grace } = arrange(api);
    const home = new EventHubPage(page);
    await api.signInAs(grace, `/events/${event.id}/hub`);

    await expect(home.postUpdate).toBeVisible();
    await expect(home.moveSession).toHaveCount(0);
  });
});
