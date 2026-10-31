// Traces to: L2-144 AC1, AC2, AC3, AC4, AC6, AC7; L2-147 AC1, AC2; L2-152 AC1
// (docs/detailed-designs/organisations/taxonomies)
import { expect, test } from '../../fixtures/app';
import { AddPartnerDialog } from '../../pages/add-partner.dialog';
import { ArchiveListEntryDialog, ListEntryNameDialog } from '../../pages/list-entry.dialogs';
import { MovePartnerDialog } from '../../pages/move-partner.dialog';
import { OrganisationTaxonomiesPage } from '../../pages/organisation-taxonomies.page';
import { PartnerPage } from '../../pages/partner.page';
import { PartnersPage } from '../../pages/partners.page';

const SETTINGS = {
  email: 'grace@example.org',
  capabilities: [
    'ManageOrganisationSettings' as const,
    'ViewPartners' as const,
    'ManagePartners' as const,
  ],
};

test.describe('Organisation settings: partner stages', () => {
  test('a settings manager sees the stages with counts, the initial stage and each kind', async ({
    page,
    api,
    axe,
  }) => {
    api.partners.add({ name: 'Kestrel Labs', stage: 'in-funnel' });
    api.partners.add({ name: 'Summit Cloud', stage: 'confirmed' });
    api.partners.add({ name: 'Maple Street Church', stage: 'confirmed' });
    const grace = api.addAccount(SETTINGS);
    const taxonomies = new OrganisationTaxonomiesPage(page);
    await api.signInAs(grace, '/organisation/taxonomies');

    await expect(taxonomies.tab).toHaveAttribute('aria-current', 'page');
    await expect.poll(() => taxonomies.stageNames()).toEqual(['Lead', 'In Funnel', 'Confirmed']);
    await expect(taxonomies.row('Lead')).toContainText('0 partners');
    await expect(taxonomies.row('Lead')).toContainText('Initial');
    await expect(taxonomies.row('In Funnel')).toContainText('1 partner');
    await expect(taxonomies.row('Confirmed')).toContainText('2 partners');
    await axe.check();

    await taxonomies.menu('Lead').click();
    await expect(taxonomies.menuItem('Set as initial')).toBeDisabled();
    await expect(taxonomies.menuItem('Open')).toHaveAttribute('aria-checked', 'true');
    await expect(taxonomies.menuItem('Confirmed')).toHaveAttribute('aria-checked', 'false');
    await axe.check();
  });

  test('a settings manager adds a stage, which becomes the last column on the board', async ({
    page,
    api,
    axe,
  }) => {
    api.partners.add({ name: 'Kestrel Labs' });
    const grace = api.addAccount(SETTINGS);
    const taxonomies = new OrganisationTaxonomiesPage(page);
    const partners = new PartnersPage(page);
    await api.signInAs(grace, '/organisation/taxonomies');

    await taxonomies.addStage.click();
    const add = new ListEntryNameDialog(page, 'Add a partner stage');
    await expect(add.name).toBeFocused();
    await add.name.fill('lead');
    await add.save.click();
    await expect(add.error('There’s already a stage called lead.')).toBeVisible();
    await axe.check();
    await add.name.fill('Proposal sent');
    await add.save.click();

    await expect(add.dialog).toBeHidden();
    await expect(taxonomies.toast('Proposal sent added')).toContainText(
      'It’s the last column on the partner board.',
    );
    await expect
      .poll(() => taxonomies.stageNames())
      .toEqual(['Lead', 'In Funnel', 'Confirmed', 'Proposal sent']);
    expect(api.audit.at(-1)).toMatchObject({ action: 'taxonomy.updated' });

    await partners.open();
    await expect(partners.board.getByRole('heading', { level: 2 })).toHaveText([
      'Lead',
      'In Funnel',
      'Confirmed',
      'Proposal sent',
    ]);
  });

  test('a rename shows on the board and in partner history, and the order is saved', async ({
    page,
    api,
  }) => {
    const kestrel = api.partners.add({ name: 'Kestrel Labs', stage: 'lead' });
    const grace = api.addAccount(SETTINGS);
    api.partners.addActivity(kestrel, {
      kind: 'StageMoved',
      summary: null,
      fromStage: 'in-funnel',
      toStage: 'lead',
      occurredAt: '23:00:00',
      loggedById: grace.profileId,
    });
    const taxonomies = new OrganisationTaxonomiesPage(page);
    const partners = new PartnersPage(page);
    const partner = new PartnerPage(page);
    await api.signInAs(grace, '/organisation/taxonomies');

    await taxonomies.choose('In Funnel', 'Rename');
    const rename = new ListEntryNameDialog(page, 'Rename In Funnel');
    await expect(rename.name).toHaveValue('In Funnel');
    await rename.name.fill('In conversation');
    await rename.save.click();
    await expect(taxonomies.toast('Renamed to In conversation')).toContainText(
      'The board column and partner history show the new name.',
    );

    await taxonomies.moveDown('Lead').click();
    await expect
      .poll(() => taxonomies.stageNames())
      .toEqual(['In conversation', 'Lead', 'Confirmed']);
    expect(api.callsTo('PUT', '/api/organisation/partner-stages/order').length).toBe(1);

    await partners.open();
    await expect(partners.board.getByRole('heading', { level: 2 })).toHaveText([
      'In conversation',
      'Lead',
      'Confirmed',
    ]);
    await page.goto(`/partners/${kestrel.id}`);
    await expect(partner.entries.first()).toContainText(
      'Moved Kestrel Labs from In conversation to Lead',
    );
  });

  test('the row menu sets the initial stage and the kind', async ({ page, api }) => {
    const grace = api.addAccount(SETTINGS);
    const taxonomies = new OrganisationTaxonomiesPage(page);
    const partners = new PartnersPage(page);
    await api.signInAs(grace, '/organisation/taxonomies');

    await taxonomies.choose('In Funnel', 'Set as initial');
    await expect(taxonomies.toast('In Funnel is the initial stage')).toContainText(
      'New partners start on In Funnel.',
    );
    await expect(taxonomies.row('In Funnel')).toContainText('Initial');
    await expect(taxonomies.row('Lead')).not.toContainText('Initial');

    await taxonomies.choose('In Funnel', 'Confirmed');
    await taxonomies.menu('In Funnel').click();
    await expect(taxonomies.menuItem('Confirmed')).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('Escape');
    expect(
      api.callsTo('PUT', '/api/organisation/partner-stages/stage-in-funnel').at(-1)!.body,
    ).toEqual({ kind: 'Confirmed' });

    await partners.open();
    await partners.addPartner.click();
    const add = new AddPartnerDialog(page);
    await expect(add.stage).toHaveValue('in-funnel');
  });

  test('a stage with partners cannot be archived; an empty one is archived and listed under Archived', async ({
    page,
    api,
    axe,
  }) => {
    api.partners.add({ name: 'Kestrel Labs', stage: 'in-funnel' });
    const summit = api.partners.add({ name: 'Summit Cloud', stage: 'lead' });
    const grace = api.addAccount(SETTINGS);
    api.partners.stages.add('Proposal sent');
    api.partners.addActivity(summit, {
      kind: 'StageMoved',
      summary: null,
      fromStage: 'proposal-sent',
      toStage: 'lead',
      occurredAt: '23:00:00',
      loggedById: grace.profileId,
    });
    const taxonomies = new OrganisationTaxonomiesPage(page);
    const partner = new PartnerPage(page);
    await api.signInAs(grace, '/organisation/taxonomies');

    await taxonomies.choose('In Funnel', 'Archive');
    const refused = new ArchiveListEntryDialog(page, 'In Funnel');
    await expect(refused.refusal('In Funnel')).toContainText(
      '1 partner is on this stage. Move it first.',
    );
    await expect(refused.openBoard).toHaveAttribute('href', '/partners');
    await axe.check();
    await refused.close.click();
    await expect(refused.dialog).toBeHidden();

    await taxonomies.choose('Proposal sent', 'Archive');
    const archive = new ArchiveListEntryDialog(page, 'Proposal sent');
    await archive.confirm.click();
    await expect(archive.dialog).toBeHidden();
    await expect(taxonomies.toast('Proposal sent archived')).toBeVisible();
    await expect.poll(() => taxonomies.stageNames()).toEqual(['Lead', 'In Funnel', 'Confirmed']);

    await taxonomies.archived.click();
    await expect(taxonomies.archivedStages).toContainText('Proposal sent');
    await expect(taxonomies.archivedStages).toContainText('no partners');
    await axe.check();

    await page.goto(`/partners/${summit.id}`);
    await expect(partner.entries.first()).toContainText(
      'Moved Summit Cloud from Proposal sent (archived) to Lead',
    );
  });

  test('a partner on an archived stage waits in its own column until it is moved', async ({
    page,
    api,
    axe,
  }) => {
    const prospect = api.partners.stages.add('Prospect', { archived: true });
    api.partners.add({ name: 'Orchard Trust', stage: prospect.key });
    const grace = api.addAccount(SETTINGS);
    const partners = new PartnersPage(page);
    await api.signInAs(grace, '/partners');

    await expect(partners.board.getByRole('heading', { level: 2 })).toHaveText([
      'Lead',
      'In Funnel',
      'Confirmed',
      'Archived stage: Prospect',
    ]);
    await expect(partners.column('Archived stage: Prospect')).toContainText('Orchard Trust');
    await axe.check();

    await partners.move('Orchard Trust').click();
    const move = new MovePartnerDialog(page);
    await move.stage('Lead').check();
    await move.confirm.click();

    await expect(partners.column('Lead')).toContainText('Orchard Trust');
    await expect(partners.board.getByRole('heading', { level: 2 })).toHaveText([
      'Lead',
      'In Funnel',
      'Confirmed',
    ]);
  });

  test('a role manager reads the stages but cannot change them', async ({ page, api, axe }) => {
    const ruth = api.addAccount({ email: 'ruth@example.org', capabilities: ['ManageRoles'] });
    const taxonomies = new OrganisationTaxonomiesPage(page);
    await api.signInAs(ruth, '/organisation/taxonomies');

    await expect(taxonomies.readOnly).toBeVisible();
    await expect.poll(() => taxonomies.stageNames()).toEqual(['Lead', 'In Funnel', 'Confirmed']);
    await expect(taxonomies.addStage).toHaveCount(0);
    await expect(taxonomies.menu('Lead')).toHaveCount(0);
    await axe.check();
  });

  test('when the stages cannot load, Try again loads them', async ({ page, api, axe }) => {
    const grace = api.addAccount(SETTINGS);
    let failing = true;
    api.on('GET', '/api/organisation/partner-stages', (route) =>
      failing ? route.fulfill({ status: 503 }) : api.fallback(route),
    );
    const taxonomies = new OrganisationTaxonomiesPage(page);
    await api.signInAs(grace, '/organisation/taxonomies');

    await expect(taxonomies.loadError).toBeVisible();
    await axe.check();
    failing = false;
    await taxonomies.tryAgain.click();
    await expect.poll(() => taxonomies.stageNames()).toEqual(['Lead', 'In Funnel', 'Confirmed']);
  });
});
