import { expect, test } from '../../../e2e/fixtures/app';
import { MovePartnerDialog } from '../../../e2e/pages/move-partner.dialog';
import { PartnerPage } from '../../../e2e/pages/partner.page';
import { PartnersPage } from '../../../e2e/pages/partners.page';
import { Presenter, typeInto } from '../presenter';

// Journey: the partner Kanban board (docs/detailed-designs/partners/partner-kanban-board, L2-018).
test('partner-kanban-board', async ({ page, api }) => {
  const show = await Presenter.start(page, 'partner-kanban-board');
  const partners = new PartnersPage(page);
  const dialog = new MovePartnerDialog(page);
  const partner = new PartnerPage(page);
  const grace = api.addAccount({
    email: 'grace@example.org',
    name: 'Grace Okonkwo',
    roles: ['CityLead'],
  });
  api.partners.add({ name: 'Maple Street Church', contactName: 'Kwame Asante' });
  const northgate = api.partners.add({
    name: 'Northgate Credit Union',
    offering: 'Sponsorship enquiry',
  });
  api.partners.addActivity(northgate, {
    kind: 'Call',
    summary: 'Asked about sponsoring the hackathon.',
    occurredOn: '2026-10-19',
    nextStep: 'Send the sponsor pack',
    nextStepDue: '2026-10-26',
    loggedById: grace.profileId,
  });
  api.partners.add({ name: 'Kestrel Labs', stage: 'InFunnel' });
  api.partners.add({ name: 'Summit Cloud', stage: 'Confirmed' });

  await show.card(
    'opening',
    'opening',
    ['The partner pipeline', 'Recorded against a local fake API · synthetic organisations'],
    () => api.signInAs(grace, '/partners'),
  );

  await show.step(
    'board',
    async () => {
      await expect(partners.board.getByRole('heading', { level: 2 })).toHaveText([
        'Lead',
        'In funnel',
        'Confirmed',
      ]);
      await expect(partners.column('Lead').getByRole('listitem')).toHaveCount(2);
      await expect(partners.column('In funnel').getByRole('listitem')).toHaveCount(1);
      await expect(partners.card('Northgate Credit Union')).toContainText(
        'Next: Send the sponsor pack',
      );
    },
    { poster: true },
  );

  await show.step('drag', async () => {
    await partners.drag('Maple Street Church', 'In funnel');
    await expect(partners.announcement).toHaveText('Maple Street Church moved to In funnel');
    await expect(partners.column('In funnel')).toContainText('Maple Street Church');
    await expect(partners.column('Lead').getByRole('listitem')).toHaveCount(1);
  });

  await show.step('move-dialog', async () => {
    await partners.move('Kestrel Labs').click();
    await dialog.opened();
    await expect(dialog.stage('Confirmed')).toBeChecked();
  });

  await show.step('note', async () => {
    await typeInto(dialog.note, 'Contract signed.');
    await dialog.confirm.click();
    await expect(dialog.dialog).toBeHidden();
    await expect(partners.column('Confirmed')).toContainText('Kestrel Labs');
    await expect(partners.announcement).toHaveText('Kestrel Labs moved to Confirmed');
  });

  await show.step('timeline', async () => {
    await partners.card('Kestrel Labs').getByRole('link').click();
    await expect(partner.stage).toHaveText('Confirmed');
    await expect(partner.entries.first()).toContainText('Stage moved · Grace Okonkwo');
    await expect(partner.entries.first()).toContainText(
      'Moved Kestrel Labs from In funnel to Confirmed: “Contract signed.”',
    );
  });

  await show.card('closing', 'closing', [
    'Lead, In funnel and Confirmed',
    'Drag a card, or use the Move dialog from the keyboard',
    'Every move is kept on the partner’s activity timeline',
  ]);
  await show.finish();
});
