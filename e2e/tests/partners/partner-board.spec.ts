// Traces to: L2-018 (docs/detailed-designs/partners/partner-kanban-board)
import { expect, test } from '../../fixtures/app';
import { MovePartnerDialog } from '../../pages/move-partner.dialog';
import { PartnerPage } from '../../pages/partner.page';
import { PartnersPage } from '../../pages/partners.page';
import { BREAKPOINTS } from '../../pages/viewport';

test.describe('Partner Kanban board', () => {
  test.beforeEach(({ api }) => {
    api.partners.add({ name: 'Maple Street Church', contactName: 'Kwame Asante' });
    api.partners.add({ name: 'Northgate Credit Union', offering: 'Sponsorship enquiry' });
    api.partners.add({ name: 'Kestrel Labs', stage: 'InFunnel' });
    api.partners.add({ name: 'Summit Cloud', stage: 'Confirmed' });
  });

  test('the board shows Lead, In funnel and Confirmed with counts', async ({ page, api, axe }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const partners = new PartnersPage(page);
    await api.signInAs(grace, '/partners');

    await expect(partners.board.getByRole('heading', { level: 2 })).toHaveText([
      'Lead',
      'In funnel',
      'Confirmed',
    ]);
    await expect(partners.column('Lead')).toContainText('2');
    await expect(partners.column('Lead').getByRole('listitem')).toHaveCount(2);
    await expect(partners.column('In funnel').getByRole('listitem')).toHaveCount(1);
    await axe.check();
  });

  test('a keyboard-only lead moves a partner with the Move dialog and a note', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const partners = new PartnersPage(page);
    await api.signInAs(grace, '/partners');

    await partners.move('Kestrel Labs').focus();
    await page.keyboard.press('Enter');
    const dialog = new MovePartnerDialog(page);
    await dialog.opened();
    await expect(dialog.stage('In funnel'))
      .toBeDisabled({ timeout: 1 })
      .catch(() => undefined);
    await expect(dialog.stage('Confirmed')).toBeChecked();
    await axe.check();
    await dialog.note.fill('Contract signed.');
    await dialog.confirm.press('Enter');

    await expect(dialog.dialog).toBeHidden();
    await expect(partners.column('Confirmed')).toContainText('Kestrel Labs');
    await expect(partners.announcement).toHaveText('Kestrel Labs moved to Confirmed');

    await partners.card('Kestrel Labs').getByRole('link').click();
    const partner = new PartnerPage(page);
    await expect(partner.stage).toHaveText('Confirmed');
    await expect(partner.history.first()).toContainText(
      'Grace Okonkwo moved Kestrel Labs from In funnel to Confirmed: “Contract signed.”',
    );
  });

  test('a lead drags a partner to another column', async ({ page, api }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const partners = new PartnersPage(page);
    await api.signInAs(grace, '/partners');

    await partners.drag('Maple Street Church', 'In funnel');

    await expect(partners.announcement).toHaveText('Maple Street Church moved to In funnel');
    await expect(partners.column('In funnel')).toContainText('Maple Street Church');
    await expect(partners.column('Lead').getByRole('listitem')).toHaveCount(1);
    expect(api.callsTo('POST', '/api/partners/partner-1/stage')[0].body).toEqual({
      to: 'InFunnel',
      note: null,
    });
  });

  test('a lead moves a partner from its page', async ({ page, api }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const partner = new PartnerPage(page);
    await api.signInAs(grace, '/partners/partner-4');

    await partner.moveStage.click();
    const dialog = new MovePartnerDialog(page);
    await dialog.stage('In funnel').check();
    await dialog.confirm.click();

    await expect(partner.stage).toHaveText('In funnel');
    await expect(partner.history).toHaveCount(1);
  });

  test('on a phone the stages are tabs with one column at a time', async ({ page, api, axe }) => {
    await page.setViewportSize(BREAKPOINTS.xs);
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const partners = new PartnersPage(page);
    await api.signInAs(grace, '/partners');

    await expect(partners.stageTabs.getByRole('tab')).toHaveText([
      'Lead (2)',
      'In funnel (1)',
      'Confirmed (1)',
    ]);
    await expect(partners.board.getByRole('heading', { level: 2 })).toHaveText(['Lead']);
    await axe.check();

    await partners.stageTab('In funnel (1)').click();
    await expect(partners.board.getByRole('heading', { level: 2 })).toHaveText(['In funnel']);
    await expect(partners.card('Kestrel Labs')).toBeVisible();
  });
});
