import { expect, test } from '../../../e2e/fixtures/app';
import { PlanningPokerPage, StartPokerDialog } from '../../../e2e/pages/planning-poker.page';
import { Presenter } from '../presenter';

// Journey: Planning Poker (docs/detailed-designs/agile/planning-poker, L2-038).
test('planning-poker', async ({ page, api }) => {
  const show = await Presenter.start(page, 'planning-poker');
  const poker = new PlanningPokerPage(page);
  const grace = api.addAccount({
    email: 'grace@example.org',
    name: 'Grace Okonkwo',
    roles: ['CityLead'],
  });
  const marcus = api.addAccount({
    email: 'marcus@example.org',
    name: 'Marcus Lee',
    roles: ['EventLead'],
  });
  const ruth = api.addAccount({
    email: 'ruth@example.org',
    name: 'Ruth Alvarez',
    roles: ['Volunteer'],
  });
  const ws = api.agile.addWorkspace({
    name: 'Toronto team',
    ownerId: grace.profileId,
    memberIds: [marcus.profileId, ruth.profileId],
  });
  api.agile.addItem({
    workspaceId: ws.id,
    kind: 'Story',
    title: 'Shelter problem briefs for teams',
    description: 'As a hackathon team, I want a one-page brief for each shelter problem.',
  });
  api.agile.addItem({
    workspaceId: ws.id,
    kind: 'Story',
    title: 'Volunteer check-in kiosk',
  });

  await show.card(
    'opening',
    'opening',
    ['Estimate stories together', 'Recorded against a local fake API · synthetic people'],
    () => api.signInAs(marcus, `/workspaces/${ws.id}/poker`),
  );

  await show.step('no-session', async () => {
    await expect(poker.noSession).toBeVisible();
    await expect(poker.startSession).toBeVisible();
  });

  const dialog = new StartPokerDialog(page);
  await show.step('start', async () => {
    await poker.startSession.click();
    await dialog.start.click();
    await expect(dialog.storyError).toBeVisible();
    await dialog.story('Shelter problem briefs for teams').check();
    await dialog.story('Volunteer check-in kiosk').check();
    await dialog.member('Grace Okonkwo').check();
    await dialog.member('Ruth Alvarez').check();
    await dialog.start.click();
    await expect(dialog.dialog).toBeHidden();
    await expect(poker.nowEstimating).toHaveText('Now estimating · 1 of 2');
  });

  await show.step('vote', async () => {
    await poker.card('8').click();
    await expect(poker.card('8')).toHaveAttribute('aria-pressed', 'true');
    await expect(poker.status).toContainText('1 of 3 have voted.');
    await expect.poll(() => api.agile.pokerWatchers(api.agile.pokerSessions[0].id)).toBe(1);
    const session = api.agile.pokerSessions[0];
    api.agile.pokerChanged(session, (s) => s.votes.set(ruth.profileId, '13'));
    await expect(poker.vote('Ruth Alvarez')).toHaveAccessibleName('Ruth Alvarez: voted');
    await expect(poker.status).toContainText('2 of 3 have voted.');
  });

  await show.step(
    'reveal',
    async () => {
      const session = api.agile.pokerSessions[0];
      api.agile.pokerChanged(session, (s) => s.votes.set(grace.profileId, '5'));
      await expect(poker.status).toContainText('3 of 3 have voted.');
      await poker.reveal.click();
      await expect(poker.vote('Ruth Alvarez')).toHaveAccessibleName('Ruth Alvarez: 13 points');
      await expect(poker.status).toContainText('Votes differ: 5 to 13');
    },
    { poster: true },
  );

  await show.step('revote', async () => {
    await poker.revote.click();
    await expect(poker.vote('Ruth Alvarez')).toHaveAccessibleName('Ruth Alvarez: still choosing');
    await poker.card('8').click();
    const session = api.agile.pokerSessions[0];
    api.agile.pokerChanged(session, (s) => {
      s.votes.set(ruth.profileId, '8');
      s.votes.set(grace.profileId, '8');
    });
    await expect(poker.status).toContainText('3 of 3 have voted.');
    await poker.reveal.click();
    await expect(poker.finalPoints).toHaveValue('8');
  });

  await show.step('set-points', async () => {
    await poker.setPoints.click();
    await expect(poker.status).toContainText('Marcus set 8 points');
    await expect(poker.nowEstimating).toHaveText('Now estimating · 2 of 2');
  });

  await show.card('closing', 'closing', [
    'Everyone votes in private',
    'The facilitator reveals, and the team agrees',
    'The final points are saved to the story',
  ]);
  await show.finish();
});
