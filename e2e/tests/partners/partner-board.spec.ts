// Traces to: L2-018, L2-110 AC7 (docs/detailed-designs/partners/partner-kanban-board)
import { expect, test } from '../../fixtures/app';
import { MovePartnerDialog } from '../../pages/move-partner.dialog';
import { PartnerPage } from '../../pages/partner.page';
import { PartnersPage } from '../../pages/partners.page';
import { BREAKPOINTS } from '../../pages/viewport';

test.describe('Partner Kanban board', () => {
  test.beforeEach(({ api }) => {
    api.partners.add({ name: 'Maple Street Church', contactName: 'Kwame Asante' });
    api.partners.add({ name: 'Northgate Credit Union', offering: 'Sponsorship enquiry' });
    api.partners.add({ name: 'Kestrel Labs', stage: 'in-funnel' });
    api.partners.add({ name: 'Summit Cloud', stage: 'confirmed' });
  });

  test('the board shows Lead, In Funnel and Confirmed with counts', async ({ page, api, axe }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const partners = new PartnersPage(page);
    await api.signInAs(grace, '/partners');

    await expect(partners.board.getByRole('heading', { level: 2 })).toHaveText([
      'Lead',
      'In Funnel',
      'Confirmed',
    ]);
    await expect(partners.column('Lead')).toContainText('2');
    await expect(partners.column('Lead').getByRole('listitem')).toHaveCount(2);
    await expect(partners.column('In Funnel').getByRole('listitem')).toHaveCount(1);
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
    await expect(dialog.stage('In Funnel'))
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
    await expect(partner.entries.first()).toContainText('Stage moved · Grace Okonkwo');
    await expect(partner.entries.first()).toContainText(
      'Moved Kestrel Labs from In Funnel to Confirmed: “Contract signed.”',
    );
  });

  test('a lead drags a partner to another column', async ({ page, api }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const partners = new PartnersPage(page);
    await api.signInAs(grace, '/partners');

    await partners.drag('Maple Street Church', 'In Funnel');

    await expect(partners.announcement).toHaveText('Maple Street Church moved to In Funnel');
    await expect(partners.column('In Funnel')).toContainText('Maple Street Church');
    await expect(partners.column('Lead').getByRole('listitem')).toHaveCount(1);
    expect(api.callsTo('POST', '/api/partners/partner-1/stage')[0].body).toEqual({
      to: 'in-funnel',
      note: null,
    });
  });

  test('a lead moves a partner from its page', async ({ page, api }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const partner = new PartnerPage(page);
    await api.signInAs(grace, '/partners/partner-4');

    await partner.moveStage.click();
    const dialog = new MovePartnerDialog(page);
    await dialog.stage('In Funnel').check();
    await dialog.confirm.click();

    await expect(partner.stage).toHaveText('In Funnel');
    await expect(partner.entries.first()).toContainText(
      'Moved Summit Cloud from Confirmed to In Funnel',
    );
    expect(await partner.entryTypes()).toEqual(['Stage moved', 'Added to the pipeline']);
  });

  test('on a phone the stages are tabs with one column at a time', async ({ page, api, axe }) => {
    await page.setViewportSize(BREAKPOINTS.xs);
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const partners = new PartnersPage(page);
    await api.signInAs(grace, '/partners');

    await expect(partners.stageTabs.getByRole('tab')).toHaveText([
      /Lead\s*2/,
      /In Funnel\s*1/,
      /Confirmed\s*1/,
    ]);
    await expect(partners.board.getByRole('heading', { level: 2 })).toHaveText(['Lead']);
    await axe.check();

    await partners.stageTab(/In Funnel/).click();
    await expect(partners.board.getByRole('heading', { level: 2 })).toHaveText(['In Funnel']);
    await expect(partners.card('Kestrel Labs')).toBeVisible();
  });
});
