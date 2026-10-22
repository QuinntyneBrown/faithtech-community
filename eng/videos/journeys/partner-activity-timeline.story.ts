import { expect, test } from '../../../e2e/fixtures/app';
import { AppShell } from '../../../e2e/pages/app-shell.page';
import { LogActivityDialog } from '../../../e2e/pages/log-activity.dialog';
import { PartnerPage } from '../../../e2e/pages/partner.page';
import { PartnersPage } from '../../../e2e/pages/partners.page';
import { Presenter, typeInto } from '../presenter';

test.use({ timezoneId: 'America/Toronto' });

// Journey: the partner activity timeline (docs/detailed-designs/partners/partner-activity-timeline,
// L2-110 to L2-112).
test('partner-activity-timeline', async ({ page, api }) => {
  const show = await Presenter.start(page, 'partner-activity-timeline');
  const partner = new PartnerPage(page);
  const partners = new PartnersPage(page);
  const dialog = new LogActivityDialog(page);
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
    contactName: 'Nadia Petrov',
    offering: 'Venue for Builders Night',
    ownerId: grace.profileId,
  });
  kestrel.activities[0].occurredOn = '2026-09-28';
  api.partners.addActivity(kestrel, {
    kind: 'Meeting',
    summary: 'Toured the studio with Nadia. Room for 60 with a projector.',
    occurredOn: '2026-10-08',
    occurredAt: '10:00:00',
    loggedById: esther.profileId,
  });
  api.partners.addActivity(kestrel, {
    kind: 'Email',
    summary: 'Sent the Builders Night run-of-show and the date options.',
    occurredOn: '2026-10-14',
    loggedById: esther.profileId,
  });
  api.partners.add({ name: 'Maple Street Church', contactName: 'Kwame Asante' });
  api.partners.add({ name: 'Summit Cloud', stage: 'Confirmed' });
  await api.freezeBrowserClock();

  await show.card(
    'opening',
    'opening',
    [
      'Every touchpoint in one place',
      'Recorded against a local fake API · synthetic organisations',
    ],
    () => api.signInAs(grace, `/partners/${kestrel.id}`),
  );

  await show.step('timeline', async () => {
    await expect(partner.heading).toHaveText('Kestrel Labs');
    await expect(partner.entries).toHaveCount(3);
    await expect(partner.entries.first()).toContainText('Email · Esther Nakamura');
    await partner.timeline.scrollIntoViewIfNeeded();
  });

  await show.step('open-dialog', async () => {
    await page.evaluate(() => window.scrollTo({ top: 0 }));
    await partner.logActivity.click();
    await dialog.opened();
    await expect(dialog.type('Call')).toBeChecked();
    await expect(dialog.date).toHaveValue('2026-10-21');
  });

  await show.step(
    'fill',
    async () => {
      await typeInto(dialog.summary, 'Called Nadia about the contract. She is happy to host.');
      await dialog.time.fill('14:15');
      await typeInto(dialog.nextStep, 'Send credit-line wording');
      await dialog.nextStepDue.fill('2026-10-23');
    },
    { poster: true },
  );

  await show.step('logged', async () => {
    await dialog.save.click();
    await expect(dialog.dialog).toBeHidden();
    await expect(new AppShell(page).toasts).toContainText('Call logged for Kestrel Labs');
    await expect(partner.entries.first()).toContainText('Call · Grace Okonkwo');
    await expect(partner.entries.first()).toContainText('Next: Send credit-line wording');
  });

  await show.step('next-step', async () => {
    await expect(partner.subtitle).toContainText('Last activity Wed 21 Oct');
    await expect(partner.detail('Next step')).toContainText('Send credit-line wording');
    await page.waitForTimeout(2500);
    await partner.detail('Next step').scrollIntoViewIfNeeded();
  });

  await show.step('filter', async () => {
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await partner.filter('Emails').click();
    await expect(partner.entries).toHaveCount(1);
    await expect(partner.filteredCaption).toContainText('1 email');
    await page.waitForTimeout(1500);
    await partner.filter('Stage moves').click();
    await expect(partner.entries).toHaveCount(1);
    await page.waitForTimeout(1500);
    await partner.showAll.click();
    await expect(partner.entries).toHaveCount(4);
  });

  await show.step('board', async () => {
    await partners.open();
    await expect(partners.card('Kestrel Labs')).toContainText(
      'Next: Send credit-line wording · Fri 23 Oct',
    );
  });

  await show.card('closing', 'closing', [
    'One shared timeline for every lead',
    'Log calls, emails, meetings and notes',
    'The next step shows on the partner and its card',
  ]);
  await show.finish();
});
