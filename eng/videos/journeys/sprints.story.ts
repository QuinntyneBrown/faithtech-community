import { expect, test } from '../../../e2e/fixtures/app';
import { BacklogPage } from '../../../e2e/pages/backlog.page';
import { BoardPage } from '../../../e2e/pages/board.page';
import { CloseSprintDialog, StartSprintDialog } from '../../../e2e/pages/sprint.dialogs';
import { Presenter } from '../presenter';

// Journey: sprints (docs/detailed-designs/agile/sprints, L2-031, L2-035).
test('sprints', async ({ page, api }) => {
  const show = await Presenter.start(page, 'sprints');
  const backlog = new BacklogPage(page);
  const board = new BoardPage(page);
  const grace = api.addAccount({
    email: 'grace@example.org',
    name: 'Grace Okonkwo',
    roles: ['CityLead'],
  });
  const ws = api.agile.addWorkspace({ name: 'Toronto team', ownerId: grace.profileId });
  api.agile.addSprint({
    workspaceId: ws.id,
    name: 'Sprint 6',
    goal: 'Venue and date locked',
    startDate: '2026-10-06',
    endDate: '2026-10-17',
    state: 'Closed',
    completedPoints: 21,
    committedPoints: 23,
  });
  api.agile.addSprint({
    workspaceId: ws.id,
    name: 'Sprint 5',
    goal: 'Partner outreach kickoff',
    startDate: '2026-09-22',
    endDate: '2026-10-03',
    state: 'Closed',
    completedPoints: 18,
    committedPoints: 26,
  });
  const sprint = api.agile.addSprint({
    workspaceId: ws.id,
    name: 'Sprint 7',
    startDate: '2026-10-20',
    endDate: '2026-10-30',
    state: 'Active',
  });
  const story = (
    title: string,
    status: 'ToDo' | 'InProgress' | 'Done',
    points: number,
    inSprint: boolean,
  ) =>
    api.agile.addItem({
      workspaceId: ws.id,
      kind: 'Story',
      title,
      status,
      storyPoints: points,
      sprintId: inSprint ? sprint.id : null,
    });
  story('Hackathon registration page', 'Done', 6, true);
  story('Shelter problem briefs for teams', 'InProgress', 8, true);
  story('Hackathon photo release form', 'ToDo', 2, true);
  story('Volunteer check-in kiosk', 'ToDo', 5, false);

  await show.card(
    'opening',
    'opening',
    ['Plan, run and close a sprint', 'Recorded against a local fake API · synthetic people'],
    () => api.signInAs(grace, `/workspaces/${ws.id}/backlog`),
  );

  await show.step('active', async () => {
    await expect(backlog.sprint).toContainText('Sprint 7');
    await expect(backlog.sprint).toContainText('3 stories · 16 points · ends Fri 30 Oct.');
  });

  await show.step('history', async () => {
    await backlog.historyView.click();
    await expect(backlog.historyRow('Sprint 6')).toContainText('21 of 23 points');
    await expect(backlog.average).toHaveText('Average: 20 points per sprint.');
    await backlog.treeView.click();
  });

  await show.step('close', async () => {
    await board.open(ws.id);
    await board.closeSprint.click();
    const dialog = new CloseSprintDialog(page, 'Sprint 7');
    await expect(dialog.dialog).toContainText('6 of 16 points completed.');
    await expect(dialog.unfinished).toHaveCount(2);
    await dialog.close.click();
    await expect(dialog.dialog).toBeHidden();
    await expect(board.noSprint).toBeVisible();
  });

  const start = new StartSprintDialog(page);
  await show.step('start-dialog', async () => {
    await board.startSprint.click();
    await expect(start.dialog).toBeVisible();
    await expect(start.name).toHaveValue('Sprint 8');
    await expect(start.average).toContainText('Recent sprints completed');
    await start.start.click();
    await expect(start.error('Write a goal so the team knows what done looks like.')).toBeVisible();
    await expect(start.error('Choose at least one story.')).toBeVisible();
  });

  await show.step(
    'start',
    async () => {
      await start.goal.fill('Hackathon weekend runs smoothly');
      await start.starts.fill('2026-11-02');
      await start.ends.fill('2026-11-13');
      await start.story('Volunteer check-in kiosk').check();
      await start.story('Shelter problem briefs for teams').check();
      await start.start.click();
      await expect(start.dialog).toBeHidden();
      await expect(board.frame.subtitle).toContainText('Sprint 8');
    },
    { poster: true },
  );

  await show.card('closing', 'closing', [
    'One sprint at a time',
    'A goal and stories to start',
    'Unfinished work returns to the backlog',
  ]);
  await show.finish();
});
