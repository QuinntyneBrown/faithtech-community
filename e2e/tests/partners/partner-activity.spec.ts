// Traces to: L2-085, L2-086, L2-087 (docs/detailed-designs/partners/partner-activity-timeline)
import { expect, test } from '../../fixtures/app';
import { AppShell } from '../../pages/app-shell.page';
import { LogActivityDialog } from '../../pages/log-activity.dialog';
import { PartnerPage } from '../../pages/partner.page';

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
    await expect(partner.entries.first()).toContainText('Email · Grace Okonkwo');
  });
});
