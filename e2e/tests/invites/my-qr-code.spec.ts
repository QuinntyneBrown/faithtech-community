// Traces to: L2-080, L2-081 (docs/detailed-designs/invites/connect-by-qr-code)
import { expect, test } from '../../fixtures/app';
import { InvitesPage } from '../../pages/invites.page';
import { MyQrCodeDialog } from '../../pages/my-qr-code.dialog';

test.describe('My QR code', () => {
  test('a City Lead shows their QR code, copies the link and downloads the image', async ({
    page,
    context,
    api,
    axe,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const invites = new InvitesPage(page);
    const dialog = new MyQrCodeDialog(page);
    await api.signInAs(grace, '/invites');

    await invites.myQrCode.click();

    await expect(dialog.qrCode).toBeVisible();
    await expect(dialog.link).toHaveValue(/\/meet\/[A-Za-z0-9_-]+$/);
    await expect(dialog.explanation).toBeVisible();
    await axe.check();

    await dialog.copy.click();
    await expect(dialog.copied).toBeVisible();
    await expect(dialog.toast).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      await dialog.link.inputValue(),
    );

    const download = page.waitForEvent('download');
    await dialog.download.click();
    expect((await download).suggestedFilename()).toBe('faithtech-qr-code.png');

    await dialog.done.click();
    await expect(dialog.dialog).toHaveCount(0);
    await expect(invites.myQrCode).toBeFocused();
  });

  test('the same code shows every time until the lead makes a new one, which retires the old link', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const old = api.connect.addLink(grace.profileId);
    const invites = new InvitesPage(page);
    const dialog = new MyQrCodeDialog(page);
    await api.signInAs(grace, '/invites');
    await invites.myQrCode.click();
    expect(await dialog.token()).toBe(old.token);

    await dialog.makeNewCode.click();
    await expect(dialog.keepThisCode).toBeVisible();
    await axe.check();
    await dialog.confirmNewCode.click();

    await expect(dialog.newCodeReady).toBeVisible();
    const fresh = await dialog.token();
    expect(fresh).not.toBe('connect-token-1');
    expect(api.connect.ownerOf('connect-token-1')).toBeUndefined();
    expect(api.connect.ownerOf(fresh)?.id).toBe(grace.profileId);
    await axe.check();
  });

  test('Keep this code leaves the link as it was', async ({ page, api }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    api.connect.addLink(grace.profileId);
    const invites = new InvitesPage(page);
    const dialog = new MyQrCodeDialog(page);
    await api.signInAs(grace, '/invites');
    await invites.myQrCode.click();

    await dialog.makeNewCode.click();
    await dialog.keepThisCode.click();

    expect(await dialog.token()).toBe('connect-token-1');
    expect(api.callsTo('POST', '/api/connect/link')).toHaveLength(0);
  });

  test('a failed new code keeps the current one and says so', async ({ page, api, axe }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    api.connect.addLink(grace.profileId);
    api.on('POST', '/api/connect/link', (route) => route.abort('failed'));
    const invites = new InvitesPage(page);
    const dialog = new MyQrCodeDialog(page);
    await api.signInAs(grace, '/invites');
    await invites.myQrCode.click();

    await dialog.makeNewCode.click();
    await dialog.confirmNewCode.click();

    await expect(dialog.newCodeFailed).toBeVisible();
    expect(await dialog.token()).toBe('connect-token-1');
    await axe.check();
  });

  test('a System Admin has a code too', async ({ page, api }) => {
    const priya = api.addAccount({
      email: 'priya@example.org',
      name: 'Priya Shah',
      roles: ['SystemAdmin'],
    });
    const invites = new InvitesPage(page);
    await api.signInAs(priya, '/invites');

    await expect(invites.myQrCode).toBeVisible();
  });

  for (const role of ['EventLead', 'CommunicationsLead']) {
    test(`a member with only ${role} does not see My QR code`, async ({ page, api }) => {
      const marcus = api.addAccount({
        email: 'marcus@example.org',
        name: 'Marcus Lee',
        roles: [role],
      });
      const invites = new InvitesPage(page);
      await api.signInAs(marcus, '/invites');

      await expect(invites.heading).toHaveText('Invites');
      await expect(invites.inviteSomeone).toBeVisible();
      await expect(invites.myQrCode).toHaveCount(0);
    });
  }
});
