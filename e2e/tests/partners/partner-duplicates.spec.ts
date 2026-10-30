// Traces to: L2-113 (docs/detailed-designs/partners/duplicate-detection-and-merge)
import { expect, test } from '../../fixtures/app';
import { AppShell } from '../../pages/app-shell.page';
import { PartnerPage } from '../../pages/partner.page';

test.describe('Possible duplicate partner', () => {
  test.beforeEach(async ({ api }) => {
    const esther = api.addAccount({
      email: 'esther@example.org',
      name: 'Esther Nakamura',
      roles: ['CityLead'],
    });
    api.partners.add({
      name: 'Kestrel Labs',
      stage: 'InFunnel',
      website: 'https://kestrel.example',
      offering: 'Venue for Builders Night',
    });
    const other = api.partners.add({
      name: 'Kestrel Labs Inc.',
      website: 'www.kestrel.example/about',
      ownerId: esther.profileId,
    });
    other.activities[0].occurredOn = '2026-10-13';
    await api.freezeBrowserClock();
  });

  // Given a partner with an undismissed possible duplicate, when a City Lead opens it, then a
  // warning alert names the match, who added it and when, and why, with Compare and merge,
  // Open {other} and Not the same (AC1, AC4).
  test('a City Lead sees the alert naming the match, who added it and when', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const partner = new PartnerPage(page);
    await api.signInAs(grace, '/partners/partner-1');

    await expect(partner.duplicateAlert).toContainText(
      'This may be the same partner as “Kestrel Labs Inc.”',
    );
    await expect(partner.duplicateAlert).toContainText(
      'Esther Nakamura added Kestrel Labs Inc. on Tue 13 Oct with the same website, kestrel.example.',
    );
    await expect(partner.duplicateAlert).toContainText(
      'Merging keeps one record and moves both activity timelines into it.',
    );
    await expect(partner.notTheSame).toBeVisible();
    await expect(partner.compareAndMerge).toBeVisible();
    await axe.check();

    await partner.openDuplicate('Kestrel Labs Inc.').click();
    await expect(page).toHaveURL('/partners/partner-2');
    await expect(partner.heading).toHaveText('Kestrel Labs Inc.');
    await expect(partner.duplicateAlert).toContainText(
      'This may be the same partner as “Kestrel Labs”',
    );
  });

  // Given more than one undismissed match, when the alert renders, then it names the first by
  // name and adds "and N more" (AC5).
  test('several matches name the first and count the rest', async ({ page, api }) => {
    api.partners.add({ name: 'kestrel labs ltd' });
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const partner = new PartnerPage(page);
    await api.signInAs(grace, '/partners/partner-1');

    await expect(partner.duplicateAlert).toContainText(
      'This may be the same partner as “Kestrel Labs Inc.” and 1 more',
    );
  });

  // Given Staff, when they open the partner, then they see the alert without Compare and merge
  // and Not the same, and can still open the other partner (AC4).
  test('Staff see the alert read-only', async ({ page, api, axe }) => {
    const daniel = api.addAccount({
      email: 'daniel@example.org',
      name: 'Daniel Reyes',
      roles: ['Staff'],
    });
    const partner = new PartnerPage(page);
    await api.signInAs(daniel, '/partners/partner-1');

    await expect(partner.duplicateAlert).toBeVisible();
    await expect(partner.openDuplicate('Kestrel Labs Inc.')).toBeVisible();
    await expect(partner.notTheSame).toHaveCount(0);
    await expect(partner.compareAndMerge).toHaveCount(0);
    await axe.check();
  });

  // Given a lead, when they choose Not the same, then the pair is dismissed, the alert goes,
  // focus moves to the page heading and a toast confirms it (AC6).
  test('Not the same dismisses the pair', async ({ page, api, axe }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const partner = new PartnerPage(page);
    await api.signInAs(grace, '/partners/partner-1');

    await partner.notTheSame.click();

    await expect(partner.duplicateAlert).toHaveCount(0);
    await expect(partner.heading).toBeFocused();
    await expect(new AppShell(page).toasts).toContainText(
      'Marked Kestrel Labs Inc. as a different partner',
    );
    expect(
      api.callsTo('POST', '/api/partners/partner-1/duplicates/partner-2/dismissal'),
    ).toHaveLength(1);
    expect(api.partners.dismissals).toEqual([
      expect.objectContaining({ lower: 'partner-1', higher: 'partner-2', byId: grace.profileId }),
    ]);
    await axe.check();
  });

  // Given another lead dismissed the pair, when a lead opens either partner, then no alert shows
  // (AC6).
  test('a dismissed pair shows no alert for any lead', async ({ page, api }) => {
    api.partners.dismiss('partner-2', 'partner-1', 'profile-1');
    const marcus = api.addAccount({
      email: 'marcus@example.org',
      name: 'Marcus Lee',
      roles: ['EventLead'],
    });
    const partner = new PartnerPage(page);
    await api.signInAs(marcus, '/partners/partner-2');

    await expect(partner.heading).toHaveText('Kestrel Labs Inc.');
    await expect(partner.entries.first()).toBeVisible();
    await expect(partner.duplicateAlert).toHaveCount(0);
  });
});
