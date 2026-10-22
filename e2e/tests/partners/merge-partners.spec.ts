// Traces to: L2-114, L2-115, L2-112 (docs/detailed-designs/partners/duplicate-detection-and-merge)
import { Route } from '@playwright/test';

import { expect, test } from '../../fixtures/app';
import { MockAccount } from '../../fixtures/mock-api';
import { AppShell } from '../../pages/app-shell.page';
import { MergePartnersDialog } from '../../pages/merge-partners.dialog';
import { PartnerPage } from '../../pages/partner.page';
import { PartnersPage } from '../../pages/partners.page';
import { BREAKPOINTS, hasHorizontalScroll } from '../../pages/viewport';

test.describe('Merge partners', () => {
  let grace: MockAccount;

  test.beforeEach(async ({ api }) => {
    grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const esther = api.addAccount({
      email: 'esther@example.org',
      name: 'Esther Nakamura',
      roles: ['CityLead'],
    });
    api.partners.add({
      name: 'Kestrel Labs',
      stage: 'InFunnel',
      website: 'kestrel.example',
      offering: 'Venue for Builders Night',
      ownerId: grace.profileId,
      contactName: 'Nadia Petrov',
      email: 'nadia@kestrel.example',
      notes: 'Studio of 12 developers.',
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
      summary: 'Nadia asked about hosting.',
      occurredOn: '2026-10-14',
      loggedById: esther.profileId,
    });
    await api.freezeBrowserClock();
  });

  async function openDialog(page: import('@playwright/test').Page): Promise<MergePartnersDialog> {
    await new PartnerPage(page).compareAndMerge.click();
    const dialog = new MergePartnersDialog(page);
    await dialog.opened();
    return dialog;
  }

  // Given a possible duplicate, when a lead chooses Compare and merge, then the dialog offers only
  // the fields that differ, with the current record's values selected (L2-114 AC1).
  test('offers only the differing fields with the current values selected', async ({
    page,
    api,
    axe,
  }) => {
    await api.signInAs(grace, '/partners/partner-1');

    const dialog = await openDialog(page);

    await expect(dialog.dialog).toContainText('Merge Kestrel Labs Inc. into Kestrel Labs');
    await expect(dialog.dialog).toContainText('Nothing is lost');
    await expect(dialog.fields).toHaveCount(5);
    for (const label of ['Name', 'Stage', 'Main contact', 'Phone', 'Owner']) {
      await expect(dialog.value(label, 'keep')).toBeChecked();
      await expect(dialog.value(label, 'other')).not.toBeChecked();
    }
    await expect(dialog.field('Phone')).toContainText('Not set');
    await expect(dialog.field('Owner')).toContainText('Esther Nakamura');
    await expect(dialog.sameFields).toHaveText(
      'Email, website and offering are the same on both and are kept as they are. Notes from both records are joined, Kestrel Labs’s first.',
    );
    await axe.check();
  });

  // Given the lead's choices, when they confirm, then the merged partner shows the chosen values,
  // both timelines with the Merged entry on top, and a toast; the alert is gone (AC2, AC3).
  test('merging lands on the kept partner with both timelines', async ({ page, api, axe }) => {
    await api.signInAs(grace, '/partners/partner-1');
    const partner = new PartnerPage(page);
    const dialog = await openDialog(page);

    await dialog.value('Phone', 'other').check();
    await dialog.value('Owner', 'other').check();
    await dialog.confirm.click();

    await expect(dialog.dialog).toBeHidden();
    await expect(new AppShell(page).toasts).toContainText(
      'Merged Kestrel Labs Inc. into Kestrel Labs',
    );
    await expect(partner.entries.first()).toContainText(
      'Merged Kestrel Labs Inc. into Kestrel Labs',
    );
    await expect(partner.timeline).toContainText('Nadia asked about hosting.');
    await expect(partner.entries.filter({ hasText: 'Nadia asked about hosting.' })).toContainText(
      'from Kestrel Labs Inc.',
    );
    await expect(partner.detail('Phone')).toHaveText('416-555-0199');
    await expect(partner.detail('Owner')).toHaveText('Esther Nakamura');
    await expect(partner.detail('Notes')).toContainText('Studio of 12 developers.');
    await expect(partner.detail('Notes')).toContainText('Met Nadia at the spring builders night.');
    await expect(partner.duplicateAlert).toHaveCount(0);
    expect(api.callsTo('POST', '/api/partners/partner-1/merge')[0].body).toEqual({
      otherId: 'partner-2',
      keepVersion: 1,
      otherVersion: 1,
      choices: {
        name: 'keep',
        stage: 'keep',
        contactName: 'keep',
        phone: 'other',
        owner: 'other',
      },
    });
    await axe.check();

    await page.goto('/partners');
    await expect(new PartnersPage(page).card('Kestrel Labs Inc.')).toHaveCount(0);
  });

  // Given the merge is in flight, when the lead waits, then Merge partners is busy and cannot be
  // pressed again (AC6).
  test('the confirm button is busy while the merge runs', async ({ page, api, axe }) => {
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    api.on('POST', '/api/partners/partner-1/merge', async (route: Route) => {
      await held;
      await api.fallback(route);
    });
    await api.signInAs(grace, '/partners/partner-1');
    const dialog = await openDialog(page);

    await dialog.confirm.click();

    await expect(dialog.confirm).toHaveAttribute('aria-busy', 'true');
    await dialog.confirm.click({ force: true });
    await axe.check();
    release();
    await expect(dialog.dialog).toBeHidden();
    expect(api.callsTo('POST', '/api/partners/partner-1/merge')).toHaveLength(1);
  });

  // Given the other record changed after the dialog opened, when the lead confirms, then the
  // dialog shows "Partners not merged" with the reason and "Reload and try again", which reloads
  // both records so the merge then succeeds (AC5).
  test('a version conflict shows the failed state and reloads', async ({ page, api, axe }) => {
    await api.signInAs(grace, '/partners/partner-1');
    const dialog = await openDialog(page);
    api.partners.bumpVersion('partner-2');

    await dialog.confirm.click();

    await expect(dialog.failed).toContainText(
      'Someone changed Kestrel Labs Inc. while you were comparing. Nothing was changed; reload and try again.',
    );
    await expect(dialog.confirm).toHaveCount(0);
    await axe.check();

    await dialog.reload.click();
    await expect(dialog.failed).toHaveCount(0);
    await dialog.confirm.click();
    await expect(dialog.dialog).toBeHidden();
    expect(api.callsTo('POST', '/api/partners/partner-1/merge')[1].body).toMatchObject({
      otherVersion: 2,
    });
  });

  // Given an archived partner, when a lead opens its page, then it says who merged it, when and
  // into which partner with a link, and offers no Log activity, Move stage, Edit or Restore
  // (AC7, L2-112 AC6, L2-115 AC5).
  test('the archived page says who merged it and links to the kept partner', async ({
    page,
    api,
    axe,
  }) => {
    Object.assign(api.partners.partners[1], {
      archivedAtUtc: '2026-10-21T12:00:00.000Z',
      mergedIntoId: 'partner-1',
      mergedById: grace.profileId,
      mergedAtUtc: '2026-10-21T12:00:00.000Z',
    });
    const partner = new PartnerPage(page);
    await api.signInAs(grace, '/partners/partner-2');

    await expect(partner.archivedAlert).toContainText(
      'Kestrel Labs Inc. was merged into Kestrel Labs',
    );
    await expect(partner.archivedAlert).toContainText(
      'Grace Okonkwo merged it on Wed 21 Oct. Its activity and stage history are on Kestrel Labs.',
    );
    await expect(partner.stage).toHaveText('Archived');
    await expect(partner.logActivity).toHaveCount(0);
    await expect(partner.moveStage).toHaveCount(0);
    await expect(partner.edit).toHaveCount(0);
    await expect(partner.restore).toHaveCount(0);
    await expect(partner.duplicateAlert).toHaveCount(0);
    await axe.check();

    await partner.openKept('Kestrel Labs').click();
    await expect(page).toHaveURL('/partners/partner-1');
    await expect(partner.heading).toHaveText('Kestrel Labs');
  });

  // Given an XS viewport, when the merge dialog is shown, then each field stacks with both values
  // visible and the page does not scroll sideways (AC8).
  test('the dialog stacks the fields on a phone', async ({ page, api, axe }) => {
    await page.setViewportSize(BREAKPOINTS.xs);
    await api.signInAs(grace, '/partners/partner-1');

    const dialog = await openDialog(page);

    await expect(dialog.value('Owner', 'keep')).toBeVisible();
    await dialog.value('Owner', 'other').scrollIntoViewIfNeeded();
    await expect(dialog.value('Owner', 'other')).toBeVisible();
    expect(await hasHorizontalScroll(page)).toBe(false);
    await axe.check();
  });
});
