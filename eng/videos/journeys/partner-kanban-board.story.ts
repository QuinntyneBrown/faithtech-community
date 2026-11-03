import { expect, test } from '../../../e2e/fixtures/app';
import { MockApi } from '../../../e2e/fixtures/mock-api';
import { MovePartnerDialog } from '../../../e2e/pages/move-partner.dialog';
import { PartnerPage } from '../../../e2e/pages/partner.page';
import { PartnersPage } from '../../../e2e/pages/partners.page';
import { featuredPhoto } from '../photos';
import { Presenter, typeInto } from '../presenter';

/** The board of docs/mocks/pages/partners/default.html: four leads, three in the funnel, five confirmed. */
function seedBoard(api: MockApi, loggedById: string): void {
  const add = (name: string, stage: string, offering: string, contactName: string | null = null) =>
    api.partners.add({ name, stage, offering, contactName });
  const next = (partner: ReturnType<typeof add>, nextStep: string, nextStepDue: string) =>
    api.partners.addActivity(partner, {
      kind: 'Call',
      summary: `Called about ${nextStep.toLowerCase()}.`,
      occurredOn: '2026-10-20',
      nextStep,
      nextStepDue,
      loggedById,
    });
  add('Maple Street Church', 'lead', 'venue for spring builders night', 'Kwame Asante');
  add('Northgate Credit Union', 'lead', 'Sponsorship enquiry');
  add('Ellis Design Studio', 'lead', 'In-kind design mentors');
  add('St. Brigid’s Parish', 'lead', 'Youth coding club');
  next(
    add('Lantern Foundation', 'in-funnel', 'Grant for shelter tech · proposal sent Tue 14 Oct'),
    'Ask about the decision date',
    '2026-10-31',
  );
  const kestrel = api.partners.add({
    name: 'Kestrel Labs',
    stage: 'in-funnel',
    offering: 'Venue for Builders Night',
    contactName: 'Nadia Petrov',
    email: 'nadia@kestrel.example',
    phone: '416-555-0199',
    website: 'kestrel.example',
    ownerId: loggedById,
    notes: 'Studio of 12 developers. Nadia is the studio director.',
  });
  next(kestrel, 'Send credit-line wording', '2026-10-22');
  add('Harbour Coffee Co.', 'in-funnel', 'Catering for hackathon');
  add('Trinity Community Centre', 'confirmed', 'Hackathon venue · 14–15 Nov');
  add('Bright Path Ministries', 'confirmed', 'Volunteer network');
  add('Oakridge Bible College', 'confirmed', 'Student builders');
  add('Pine & Co. Legal', 'confirmed', 'Pro bono IP advice');
  add('Summit Cloud', 'confirmed', 'Cloud credits for the hackathon');
}

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
  api.profiles.get(grace.profileId)!.photos.push(featuredPhoto('grace-okonkwo'));
  for (const [title, minutesAgo] of [
    ['Marcus Lee logged a call with Lantern Foundation', 5],
    ['Kestrel Labs was moved to In Funnel', 40],
    ['Harbour Coffee Co. was added to the pipeline', 90],
  ] as const) {
    api.notifications.add({ recipientId: grace.profileId, title }, minutesAgo);
  }
  seedBoard(api, grace.profileId);

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
        'In Funnel',
        'Confirmed',
      ]);
      await expect(partners.column('Lead').getByRole('listitem')).toHaveCount(4);
      await expect(partners.column('In Funnel').getByRole('listitem')).toHaveCount(3);
      await expect(partners.card('Kestrel Labs')).toContainText(
        'Next: Send credit-line wording · Thu 22 Oct',
      );
    },
    { poster: true },
  );

  await show.step('drag', async () => {
    await partners.dragOver('Harbour Coffee Co.', 'Confirmed');
  });

  await show.step('drop', async () => {
    await partners.drop();
    await expect(partners.announcement).toHaveText('Harbour Coffee Co. moved to Confirmed');
    await expect(partners.column('Confirmed')).toContainText('Harbour Coffee Co.');
    await expect(partners.column('In Funnel').getByRole('listitem')).toHaveCount(2);
  });

  await show.step('move-dialog', async () => {
    await partners.move('Kestrel Labs').click();
    await dialog.opened();
    await expect(dialog.stage('Confirmed')).toBeChecked();
  });

  await show.step('note', async () => {
    await typeInto(dialog.note, 'Contract signed Tue 21 Oct.');
  });

  await show.step('timeline', async () => {
    await dialog.confirm.click();
    await expect(dialog.dialog).toBeHidden();
    await expect(partners.column('Confirmed')).toContainText('Kestrel Labs');
    await expect(partners.announcement).toHaveText('Kestrel Labs moved to Confirmed');
    await partners.card('Kestrel Labs').getByRole('link').click();
    await expect(partner.stage).toHaveText('Confirmed');
    await expect(partner.entries.first()).toContainText('Stage moved · Grace Okonkwo');
    await expect(partner.entries.first()).toContainText(
      'Moved Kestrel Labs from In Funnel to Confirmed: “Contract signed Tue 21 Oct.”',
    );
  });

  await show.card('closing', 'closing', [
    'Lead, In Funnel and Confirmed',
    'Drag a card, or use the Move dialog from the keyboard',
    'Every move is kept on the partner’s activity timeline',
  ]);
  await show.finish();
});
