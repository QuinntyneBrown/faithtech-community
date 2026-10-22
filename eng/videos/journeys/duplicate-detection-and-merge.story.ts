import { expect, test } from '../../../e2e/fixtures/app';
import { AppShell } from '../../../e2e/pages/app-shell.page';
import { MergePartnersDialog } from '../../../e2e/pages/merge-partners.dialog';
import { PartnerPage } from '../../../e2e/pages/partner.page';
import { RestorePartnerDialog } from '../../../e2e/pages/restore-partner.dialog';
import { Presenter } from '../presenter';

test.use({ timezoneId: 'America/Toronto' });

// Journey: duplicate detection and merge (docs/detailed-designs/partners/duplicate-detection-and-merge,
// L2-113 to L2-115).
test('duplicate-detection-and-merge', async ({ page, api }) => {
  const show = await Presenter.start(page, 'duplicate-detection-and-merge');
  const partner = new PartnerPage(page);
  const merge = new MergePartnersDialog(page);
  const restore = new RestorePartnerDialog(page);
  const toasts = new AppShell(page).toasts;
  const grace = api.addAccount({
    email: 'grace@example.org',
    name: 'Grace Okonkwo',
    roles: ['CityLead'],
  });
  const esther = api.addAccount({
    email: 'esther@example.org',
    name: 'Esther Nakamura',
    roles: ['CityLead'],
  });
  const kestrel = api.partners.add({
    name: 'Kestrel Labs',
    stage: 'InFunnel',
    website: 'kestrel.example',
    offering: 'Venue for Builders Night',
    ownerId: grace.profileId,
    contactName: 'Nadia Petrov',
    email: 'nadia@kestrel.example',
    notes: 'Studio of 12 developers.',
  });
  kestrel.activities[0].occurredOn = '2026-09-28';
  api.partners.addActivity(kestrel, {
    kind: 'Meeting',
    summary: 'Toured the studio with Nadia.',
    occurredOn: '2026-10-08',
    loggedById: grace.profileId,
  });
  const other = api.partners.add({
    name: 'Kestrel Labs Inc.',
    website: 'kestrel.example',
    offering: 'Venue for Builders Night',
    ownerId: esther.profileId,
    contactName: 'N. Petrov (studio director)',
    email: 'nadia@kestrel.example',
    phone: '416-555-0199',
    notes: 'Met Nadia at the spring builders night.',
  });
  other.activities[0].occurredOn = '2026-10-13';
  api.partners.addActivity(other, {
    kind: 'Note',
    summary: 'Nadia asked about hosting in November.',
    occurredOn: '2026-10-14',
    loggedById: esther.profileId,
  });
  const graceChurch = api.partners.add({
    name: 'Grace Community Church',
    contactName: 'Pastor Ama Owusu',
    ownerId: grace.profileId,
  });
  api.partners.add({
    name: 'Grace Community Church',
    contactName: 'Rev. Daniel Hart',
    ownerId: esther.profileId,
  });
  await api.freezeBrowserClock();

  await show.card(
    'opening',
    'opening',
    ['One record per partner', 'Recorded against a local fake API · synthetic organisations'],
    () => api.signInAs(grace, `/partners/${kestrel.id}`),
  );

  await show.step(
    'alert',
    async () => {
      await expect(partner.duplicateAlert).toContainText(
        'This may be the same partner as “Kestrel Labs Inc.”',
      );
      await expect(partner.duplicateAlert).toContainText('with the same website, kestrel.example');
    },
    { poster: true },
  );

  await show.step('compare', async () => {
    await partner.compareAndMerge.click();
    await merge.opened();
    await expect(merge.dialog).toContainText('Merge Kestrel Labs Inc. into Kestrel Labs');
    await expect(merge.fields).toHaveCount(5);
  });

  await show.step('choose', async () => {
    await expect(merge.sameFields).toBeVisible();
    await page.waitForTimeout(1200);
    await merge.value('Phone', 'other').check();
    await page.waitForTimeout(800);
    await merge.value('Owner', 'other').check();
    await expect(merge.value('Owner', 'other')).toBeChecked();
  });

  await show.step('merged', async () => {
    await merge.confirm.click();
    await expect(merge.dialog).toBeHidden();
    await expect(toasts).toContainText('Merged Kestrel Labs Inc. into Kestrel Labs');
    await expect(partner.entries.first()).toContainText(
      'Merged Kestrel Labs Inc. into Kestrel Labs',
    );
    await expect(partner.duplicateAlert).toHaveCount(0);
  });

  await show.step('both-timelines', async () => {
    await expect(partner.entries.filter({ hasText: 'Nadia asked about hosting' })).toContainText(
      'from Kestrel Labs Inc.',
    );
    await expect(partner.detail('Phone')).toHaveText('416-555-0199');
    await expect(partner.detail('Owner')).toHaveText('Esther Nakamura');
    await partner.entries.filter({ hasText: 'Nadia asked about hosting' }).scrollIntoViewIfNeeded();
  });

  await show.step('archived', async () => {
    await partner.open(other.id);
    await expect(partner.archivedAlert).toContainText(
      'Kestrel Labs Inc. was merged into Kestrel Labs',
    );
    await expect(partner.stage).toHaveText('Archived');
    await expect(partner.logActivity).toHaveCount(0);
    await expect(partner.edit).toHaveCount(0);
  });

  await show.step('not-the-same', async () => {
    await partner.open(graceChurch.id);
    await expect(partner.duplicateAlert).toContainText(
      'This may be the same partner as “Grace Community Church”',
    );
    await page.waitForTimeout(2500);
    await partner.notTheSame.click();
    await expect(partner.duplicateAlert).toHaveCount(0);
    await expect(toasts).toContainText('as a different partner');
  });

  await show.step('restore', async () => {
    const priya = api.addAccount({
      email: 'priya@example.org',
      name: 'Priya Shah',
      roles: ['SystemAdmin'],
    });
    await api.signInAs(priya, `/partners/${other.id}`);
    await expect(partner.archivedAlert).toBeVisible();
    await partner.restore.click();
    await restore.opened();
    await expect(restore.dialog).toContainText('Restore Kestrel Labs Inc.?');
  });

  await show.step('restored', async () => {
    await restore.confirm.click();
    await expect(restore.dialog).toBeHidden();
    await expect(toasts).toContainText('Kestrel Labs Inc. restored');
    await expect(partner.archivedAlert).toHaveCount(0);
    await expect(partner.entries.first()).toContainText(
      'Restored Kestrel Labs Inc. from Kestrel Labs',
    );
  });

  await show.card('closing', 'closing', [
    'Possible duplicates are flagged on the partner page',
    'Merge keeps one record and both timelines',
    'Not the same dismisses a pair; a System Admin can restore',
  ]);
  await show.finish();
});
