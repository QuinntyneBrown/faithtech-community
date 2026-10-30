// Traces to: L2-115 (docs/detailed-designs/partners/duplicate-detection-and-merge)
import { expect, test } from '../../fixtures/app';
import { MockAccount } from '../../fixtures/mock-api';
import { AppShell } from '../../pages/app-shell.page';
import { PartnerPage } from '../../pages/partner.page';
import { RestorePartnerDialog } from '../../pages/restore-partner.dialog';

test.describe('Restore a merged partner', () => {
  let priya: MockAccount;

  test.beforeEach(async ({ api }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    priya = api.addAccount({
      email: 'priya@example.org',
      name: 'Priya Shah',
      roles: ['SystemAdmin'],
    });
    const kept = api.partners.add({
      name: 'Kestrel Labs',
      stage: 'InFunnel',
      website: 'kestrel.example',
    });
    const other = api.partners.add({ name: 'Kestrel Labs Inc.', website: 'kestrel.example' });
    api.partners.addActivity(other, {
      kind: 'Call',
      summary: 'Called Nadia about hosting.',
      occurredOn: '2026-10-14',
      loggedById: grace.profileId,
    });
    api.partners.mergeInto(kept, other, grace.profileId);
    await api.freezeBrowserClock();
  });

  // Given a System Admin on an archived partner's page, when they choose Restore and confirm, then
  // it is active again, its own entries are back with a Restored entry on top, and a toast says so
  // (AC4).
  test('a System Admin restores from the archived page', async ({ page, api, axe }) => {
    const partner = new PartnerPage(page);
    await api.signInAs(priya, '/partners/partner-2');

    await partner.restore.click();
    const dialog = new RestorePartnerDialog(page);
    await dialog.opened();
    await expect(dialog.dialog).toContainText('Restore Kestrel Labs Inc.?');
    await expect(dialog.dialog).toContainText(
      'It comes back as its own partner at its old stage, Lead, and the timeline entries that came from it move back from Kestrel Labs.',
    );
    await expect(dialog.dialog).toContainText(
      'The values chosen in the merge stay on Kestrel Labs.',
    );
    await axe.check();

    await dialog.confirm.click();

    await expect(dialog.dialog).toBeHidden();
    await expect(new AppShell(page).toasts).toContainText('Kestrel Labs Inc. restored');
    await expect(partner.archivedAlert).toHaveCount(0);
    await expect(partner.stage).toHaveText('Lead');
    await expect(partner.entries.first()).toContainText(
      'Restored Kestrel Labs Inc. from Kestrel Labs',
    );
    await expect(partner.timeline).toContainText('Called Nadia about hosting.');
    expect(api.callsTo('POST', '/api/partners/partner-2/restore')[0].body).toEqual({
      version: 2,
      mergedIntoVersion: 2,
    });
    await axe.check();
  });

  // Given the records changed since the page loaded, when the System Admin confirms, then the
  // dialog says the partner was not restored and offers Reload and try again (AC6).
  test('a stale page shows the failed state and reloads', async ({ page, api, axe }) => {
    const partner = new PartnerPage(page);
    await api.signInAs(priya, '/partners/partner-2');
    await partner.restore.click();
    const dialog = new RestorePartnerDialog(page);
    await dialog.opened();
    api.partners.bumpVersion('partner-1');

    await dialog.confirm.click();

    await expect(dialog.failed).toContainText(
      'Someone changed these partners since the page loaded. Nothing was changed; reload and try again.',
    );
    await axe.check();
    await dialog.reload.click();
    await expect(dialog.failed).toHaveCount(0);
    await dialog.confirm.click();
    await expect(dialog.dialog).toBeHidden();
    await expect(partner.archivedAlert).toHaveCount(0);
  });

  // Given a City Lead or Staff on an archived partner, then no Restore is shown (AC5).
  for (const roles of [['CityLead'], ['Staff']]) {
    test(`${roles[0]} sees no Restore`, async ({ page, api }) => {
      const member = api.addAccount({ email: 'marcus@example.org', name: 'Marcus Lee', roles });
      const partner = new PartnerPage(page);
      await api.signInAs(member, '/partners/partner-2');

      await expect(partner.archivedAlert).toBeVisible();
      await expect(partner.restore).toHaveCount(0);
    });
  }
});
