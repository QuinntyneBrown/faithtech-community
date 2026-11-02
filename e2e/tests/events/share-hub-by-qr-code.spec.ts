// Traces to: L2-193, L2-194, L2-195 (docs/detailed-designs/events/share-hub-by-qr-code)
import { readFileSync } from 'node:fs';
import { expect, test } from '../../fixtures/app';
import { MockApi } from '../../fixtures/mock-api';
import { EventHubPage } from '../../pages/event-hub.page';
import { HubPage } from '../../pages/hub.page';
import { HubQrFullScreen, ShareHubDialog } from '../../pages/share-hub.dialog';
import { BREAKPOINTS, hasHorizontalScroll } from '../../pages/viewport';

test.use({ timezoneId: 'America/Toronto' });

const TITLE = 'Toronto Builders Night';

/** Toronto Builders Night with a hub, and Grace, a City Lead who manages hubs. */
function arrange(api: MockApi, published = true) {
  const event = api.events.add({
    title: TITLE,
    startsAt: '2026-11-06T23:30:00.000Z',
    endsAt: '2026-11-07T02:00:00.000Z',
    venue: 'Kestrel Labs, 220 King St W, Toronto',
    visibility: 'Public',
  });
  api.events.hubs.add(event);
  if (published) api.events.hubs.publish(event.id);
  const grace = api.addAccount({
    email: 'grace@example.org',
    name: 'Grace Okonkwo',
    roles: ['CityLead'],
  });
  return { event, grace };
}

test.describe('Share a hub by QR code: the Share dialog', () => {
  // L2-193 AC1, AC2, AC3: Share opens a QR code of the hub's link with the link beside it.
  test('a lead opens Share and sees a QR code for the hub with its link', async ({
    page,
    context,
    api,
    axe,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const { event, grace } = arrange(api);
    const home = new EventHubPage(page);
    const share = new ShareHubDialog(page, TITLE);
    await api.signInAs(grace, `/events/${event.id}/hub`);
    const link = await home.link.inputValue();

    await home.share.click();

    await expect(share.qrCode).toBeVisible();
    await expect(share.caption).toBeVisible();
    await expect(share.link).toHaveValue(link);
    expect(link).toMatch(new RegExp(`/public/events/${event.id}/hub$`));
    await expect(share.linkHelp).toBeVisible();
    await expect(share.draftNote).toHaveCount(0);
    await axe.check();

    await share.copy.click();
    await expect(share.toast).toContainText('Share it with attendees and helpers.');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(link);

    await share.done.click();
    await expect(share.dialog).toHaveCount(0);
    await expect(home.share).toBeFocused();
  });

  // L2-193 AC4: a draft hub says who the code works for until it is published.
  test('a draft hub shows the draft note above the code', async ({ page, api, axe }) => {
    const { event, grace } = arrange(api, false);
    const home = new EventHubPage(page);
    const share = new ShareHubDialog(page, TITLE);
    await api.signInAs(grace, `/events/${event.id}/hub`);

    await home.share.click();

    await expect(share.draftNote).toContainText(
      'Until you publish it, the code opens the hub only for people who manage event hubs. Everyone else sees “This hub isn’t available”.',
    );
    await expect(share.qrCode).toBeVisible();
    await axe.check();
  });

  // L2-193 AC5: the code's link (checked above to be /public/events/{id}/hub) opens a published hub for anyone.
  test('the shared link opens the published hub for an anonymous visitor', async ({
    page,
    api,
  }) => {
    const { event } = arrange(api);
    const hub = new HubPage(page);

    await hub.open(event.id);

    await expect(hub.sectionHeadings.first()).toHaveText(TITLE);
    await expect(hub.banner).toBeHidden();
  });

  // L2-193 AC6: a member without ManageEventHubs gets the forbidden state and no Share.
  test('a member without the capability is not offered Share', async ({ page, api }) => {
    const { event } = arrange(api);
    const jonah = api.addAccount({
      email: 'jonah@example.org',
      name: 'Jonah Bell',
      roles: ['ProductEngineer'],
    });
    const home = new EventHubPage(page);
    await api.signInAs(jonah, `/events/${event.id}/hub`);

    await expect(home.forbidden).toBeVisible();
    await expect(home.share).toHaveCount(0);
  });

  // L2-193 AC7: on a phone the dialog is a bottom sheet with the whole code on screen, light and dark.
  test('on a phone the whole code fits, with no sideways scroll, in light and dark', async ({
    page,
    api,
    axe,
  }) => {
    await page.setViewportSize(BREAKPOINTS.xs);
    const { event, grace } = arrange(api);
    const home = new EventHubPage(page);
    const share = new ShareHubDialog(page, TITLE);
    await api.signInAs(grace, `/events/${event.id}/hub`);

    await home.share.click();

    const box = await share.qrCode.boundingBox();
    expect(box && box.x >= 0 && box.x + box.width <= BREAKPOINTS.xs.width).toBe(true);
    expect(await hasHorizontalScroll(page)).toBe(false);
    await axe.check();
    await page.emulateMedia({ colorScheme: 'dark' });
    await axe.check();
  });
});

test.describe('Share a hub by QR code: full screen', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  // L2-194 AC1, AC2, AC4: the same code fills a projector's screen with the link as text, and has no axe violations.
  test('Show full screen fills a projector with the same code, and Esc returns to the dialog', async ({
    page,
    api,
    axe,
  }) => {
    const { event, grace } = arrange(api);
    const home = new EventHubPage(page);
    const share = new ShareHubDialog(page, TITLE);
    await api.signInAs(grace, `/events/${event.id}/hub`);
    await home.share.click();
    const link = await share.link.inputValue();
    const modules = await share.modules();
    const full = new HubQrFullScreen(page, TITLE, link);

    await share.showFullScreen.click();

    await expect(full.view).toBeVisible();
    await expect(full.lead).toBeVisible();
    await expect(full.link).toBeVisible();
    await expect(full.hint).toBeVisible();
    await expect(full.close).toBeFocused();
    expect(await full.modules()).toBe(modules);
    const box = await full.qrCode.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(300);
    const hint = await full.hint.boundingBox();
    expect(hint!.y + hint!.height).toBeLessThanOrEqual(720);
    await axe.check();
    await page.emulateMedia({ colorScheme: 'dark' });
    await axe.check();

    // L2-194 AC3: Esc closes the view and focus returns to Show full screen.
    await page.keyboard.press('Escape');
    await expect(full.view).toHaveCount(0);
    await expect(share.dialog).toBeVisible();
    await expect(share.showFullScreen).toBeFocused();
  });

  // L2-194 AC3: Close full screen closes it too.
  test('Close full screen returns to the Share dialog', async ({ page, api }) => {
    const { event, grace } = arrange(api);
    const home = new EventHubPage(page);
    const share = new ShareHubDialog(page, TITLE);
    const full = new HubQrFullScreen(page, TITLE);
    await api.signInAs(grace, `/events/${event.id}/hub`);
    await home.share.click();
    await share.showFullScreen.click();

    await full.close.click();

    await expect(full.view).toHaveCount(0);
    await expect(share.showFullScreen).toBeFocused();
  });

  // L2-194 AC5: a draft hub's note shows above the code full screen.
  test('a draft hub shows its note full screen', async ({ page, api, axe }) => {
    const { event, grace } = arrange(api, false);
    const home = new EventHubPage(page);
    const share = new ShareHubDialog(page, TITLE);
    const full = new HubQrFullScreen(page, TITLE);
    await api.signInAs(grace, `/events/${event.id}/hub`);
    await home.share.click();

    await share.showFullScreen.click();

    await expect(full.draftNote).toBeVisible();
    await axe.check();
  });
});

test.describe('Share a hub by QR code: download', () => {
  // L2-195 AC1, AC2: Download image saves a PNG named after the event.
  test('Download image saves a PNG named after the event', async ({ page, api }) => {
    const { event, grace } = arrange(api);
    const home = new EventHubPage(page);
    const share = new ShareHubDialog(page, TITLE);
    await api.signInAs(grace, `/events/${event.id}/hub`);
    await home.share.click();

    const download = page.waitForEvent('download');
    await share.download.click();
    const file = await download;

    expect(file.suggestedFilename()).toBe('toronto-builders-night-hub-qr-code.png');
    const bytes = readFileSync((await file.path())!);
    expect([...bytes.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(bytes.readUInt32BE(16)).toBeGreaterThanOrEqual(900);
  });
});
