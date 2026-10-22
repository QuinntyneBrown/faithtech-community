// Traces to: L2-085, L2-086, L2-087 (docs/detailed-designs/partners/partner-activity-timeline)
import { expect, test } from '../../fixtures/app';
import { AppShell } from '../../pages/app-shell.page';
import { LogActivityDialog } from '../../pages/log-activity.dialog';
import { MovePartnerDialog } from '../../pages/move-partner.dialog';
import { PartnerPage } from '../../pages/partner.page';
import { PartnersPage } from '../../pages/partners.page';
import { BREAKPOINTS, hasHorizontalScroll } from '../../pages/viewport';

test.describe('Partner activity timeline', () => {
  test.beforeEach(async ({ api }) => {
    api.partners.add({
      name: 'Kestrel Labs',
      stage: 'InFunnel',
      offering: 'Venue for Builders Night',
    });
    // "Today" is the fake's 21 Oct 2026 in the browser too, so the date rules are fixed.
    await api.freezeBrowserClock();
  });

  // Given a City Lead on a partner page, when they log a call with what happened, a time and a
  // next step, then the dialog closes, a toast confirms it and the call tops the shared timeline.
  test('a City Lead logs a call and it tops the timeline', async ({ page, api, axe }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const partner = new PartnerPage(page);
    await api.signInAs(grace, '/partners/partner-1');

    await partner.logActivity.click();
    const dialog = new LogActivityDialog(page);
    await dialog.opened();
    await expect(dialog.type('Call')).toBeChecked();
    await expect(dialog.date).toHaveValue('2026-10-21');
    await axe.check();

    await dialog.summary.fill('Called Nadia about the contract.');
    await dialog.time.fill('14:15');
    await dialog.nextStep.fill('Send credit-line wording');
    await dialog.nextStepDue.fill('2026-10-22');
    await dialog.save.click();

    await expect(dialog.dialog).toBeHidden();
    await expect(new AppShell(page).toasts).toContainText('Call logged for Kestrel Labs');
    await expect(partner.entries.first()).toContainText('Call · Grace Okonkwo');
    await expect(partner.entries.first()).toContainText('Called Nadia about the contract.');
    await expect(partner.entries.first()).toContainText(
      'Next: Send credit-line wording · Thu 22 Oct',
    );
    await expect(partner.entries.first()).toContainText('Wed 21 Oct, 2:15 pm');
    expect(api.callsTo('POST', '/api/partners/partner-1/activities')[0].body).toEqual({
      kind: 'Call',
      summary: 'Called Nadia about the contract.',
      occurredOn: '2026-10-21',
      occurredAt: '14:15',
      nextStep: 'Send credit-line wording',
      nextStepDue: '2026-10-22',
    });
    await axe.check();
  });

  // Given the dialog, when the lead saves with no summary, a future date, or a due date with no
  // next step, then each field shows its inline error and nothing is sent.
  test('the dialog shows inline errors and saves nothing', async ({ page, api, axe }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const partner = new PartnerPage(page);
    await api.signInAs(grace, '/partners/partner-1');

    await partner.logActivity.click();
    const dialog = new LogActivityDialog(page);
    await dialog.opened();
    await dialog.type('Meeting').check();
    await expect(dialog.save).toHaveText('Log meeting');
    await dialog.date.fill('2026-10-23');
    await dialog.nextStepDue.fill('2026-10-24');
    await dialog.save.click();

    await expect(dialog.error('Say what happened, in a sentence or two.')).toBeVisible();
    await expect(dialog.error('Choose today or an earlier date.')).toBeVisible();
    await expect(dialog.error('Add the next step, or clear its due date.')).toBeVisible();
    await expect(dialog.summary).toHaveAttribute('aria-invalid', 'true');
    expect(api.callsTo('POST', '/api/partners/partner-1/activities')).toHaveLength(0);
    await axe.check();
  });

  // Given the save fails, when the API answers with an error, then the dialog keeps the input and
  // a danger message offers to try again; trying again logs it.
  test('a failed save keeps the input and offers Try again', async ({ page, api, axe }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const partner = new PartnerPage(page);
    await api.signInAs(grace, '/partners/partner-1');
    let failures = 1;
    api.on('POST', '/api/partners/partner-1/activities', (route) =>
      failures-- > 0 ? route.abort('failed') : api.fallback(route),
    );

    await partner.logActivity.click();
    const dialog = new LogActivityDialog(page);
    await dialog.opened();
    await dialog.type('Email').check();
    await dialog.summary.fill('Sent the run-of-show.');
    await dialog.save.click();

    await expect(dialog.failed).toBeVisible();
    await expect(dialog.summary).toHaveValue('Sent the run-of-show.');
    await expect(dialog.save).toHaveText('Try again');
    await axe.check();

    await dialog.save.click();
    await expect(dialog.dialog).toBeHidden();
    await expect(partner.timeline).toContainText('Email · Grace Okonkwo');
  });

  // Given a lead logs a call with a next step, when the partner page and the board render, then
  // the header shows Last activity, Details shows the next step and the Kanban card its line.
  test('the next step shows in Details and on the card, and Last activity in the header', async ({
    page,
    api,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const kestrel = api.partners.partners[0];
    api.partners.addActivity(kestrel, {
      kind: 'Call',
      occurredOn: '2026-10-16',
      nextStep: 'Send credit-line wording',
      nextStepDue: '2026-10-22',
      loggedById: grace.profileId,
    });
    api.partners.addActivity(kestrel, { kind: 'Note', occurredOn: '2026-10-20' });
    const partner = new PartnerPage(page);
    await api.signInAs(grace, `/partners/${kestrel.id}`);

    await expect(partner.subtitle).toContainText('Last activity Wed 21 Oct');
    await expect(partner.detail('Next step')).toHaveText('Send credit-line wording · Thu 22 Oct');

    await page.goto('/partners');
    await expect(new PartnersPage(page).card('Kestrel Labs')).toContainText(
      'Next: Send credit-line wording · Thu 22 Oct',
    );
  });

  // Given the type chips, when the lead picks one, then only that type is listed, the chip is
  // pressed and a caption counts the matches; Stage moves holds the Added and Stage moved entries.
  test('the type chips filter the timeline', async ({ page, api, axe }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const kestrel = api.partners.partners[0];
    for (const kind of ['Call', 'Email', 'Meeting', 'Note'] as const) {
      api.partners.addActivity(kestrel, {
        kind,
        summary: `A ${kind.toLowerCase()}.`,
        occurredOn: '2026-10-20',
      });
    }
    const partner = new PartnerPage(page);
    await api.signInAs(grace, `/partners/${kestrel.id}`);
    await partner.moveStage.click();
    await new MovePartnerDialog(page).confirm.click();
    await expect(partner.entries).toHaveCount(6);
    await expect(partner.filter('All')).toHaveAttribute('aria-pressed', 'true');

    await partner.filter('Calls').click();
    await expect(partner.entries).toHaveCount(1);
    expect(await partner.entryTypes()).toEqual(['Call']);
    await expect(partner.filter('Calls')).toHaveAttribute('aria-pressed', 'true');
    await expect(partner.filter('All')).toHaveAttribute('aria-pressed', 'false');
    await expect(partner.filteredCaption).toHaveText('1 call. Show all activity');
    await axe.check();

    await partner.filter('Stage moves').click();
    await expect(partner.entries).toHaveCount(2);
    expect(await partner.entryTypes()).toEqual(['Stage moved', 'Added to the pipeline']);
    expect(api.callsTo('GET', `/api/partners/${kestrel.id}/activities`).length).toBeGreaterThan(2);

    await partner.showAll.click();
    await expect(partner.entries).toHaveCount(6);
    await expect(partner.filter('All')).toHaveAttribute('aria-pressed', 'true');
  });

  // Given more than 50 entries, when the timeline loads, then the newest 50 show with Show older,
  // which appends the next ones without repeating any.
  test('Show older loads the next page', async ({ page, api, axe }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const kestrel = api.partners.partners[0];
    for (let day = 1; day <= 60; day++) {
      api.partners.addActivity(kestrel, {
        summary: `Note ${day}.`,
        occurredOn: `2026-08-${String((day % 28) + 1).padStart(2, '0')}`,
      });
    }
    const partner = new PartnerPage(page);
    await api.signInAs(grace, `/partners/${kestrel.id}`);

    await expect(partner.entries).toHaveCount(50);
    await axe.check();
    await partner.showOlder.click();

    await expect(partner.entries).toHaveCount(61);
    await expect(partner.showOlder).toHaveCount(0);
    const texts = await partner.entries.allTextContents();
    expect(new Set(texts).size).toBe(61);
  });

  // Given a partner with no logged entries, when the timeline renders, then the empty state
  // invites the lead to log the first activity above the system's Added entry.
  test('a partner with no touchpoints shows the empty state', async ({ page, api, axe }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const partner = new PartnerPage(page);
    await api.signInAs(grace, '/partners/partner-1');

    await expect(partner.empty).toBeVisible();
    expect(await partner.entryTypes()).toEqual(['Added to the pipeline']);
    await expect(partner.detail('Next step')).toHaveText('Not set');
    await axe.check();

    await partner.filter('Emails').click();
    await expect(partner.empty).toBeVisible();
    await expect(partner.entries).toHaveCount(0);

    await partner.emptyLogActivity.click();
    await expect(new LogActivityDialog(page).dialog).toBeVisible();
  });

  // Given the timeline fails to load, then it says so with Try again, which loads it.
  test('a timeline that fails to load offers Try again', async ({ page, api, axe }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    let failures = 1;
    api.on('GET', '/api/partners/partner-1/activities', (route) =>
      failures-- > 0 ? route.abort('failed') : api.fallback(route),
    );
    const partner = new PartnerPage(page);
    await api.signInAs(grace, '/partners/partner-1');

    await expect(partner.timelineError).toBeVisible();
    await axe.check();
    await partner.timelineError.getByRole('button', { name: 'Try again' }).click();
    await expect(partner.entries).toHaveCount(1);
  });

  // Given an XS viewport, then the timeline is one column, the chips wrap without horizontal page
  // scroll and Log activity stays reachable.
  test('on a phone the chips wrap and Log activity stays reachable', async ({ page, api, axe }) => {
    await page.setViewportSize(BREAKPOINTS.xs);
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const partner = new PartnerPage(page);
    await api.signInAs(grace, '/partners/partner-1');

    await expect(partner.filter('Stage moves')).toBeVisible();
    expect(await hasHorizontalScroll(page)).toBe(false);
    await expect(partner.logActivity).toBeVisible();
    await axe.check();
  });
});
