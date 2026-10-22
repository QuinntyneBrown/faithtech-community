// Traces to: L2-031 AC4, L2-035 (docs/detailed-designs/agile/sprints)
import { expect, test } from '../../fixtures/app';
import { MockApi } from '../../fixtures/mock-api';
import { BacklogPage } from '../../pages/backlog.page';
import { BoardPage } from '../../pages/board.page';
import { CloseSprintDialog, StartSprintDialog } from '../../pages/sprint.dialogs';
import { WorkItemPage } from '../../pages/work-item.page';

function scrum(api: MockApi) {
  const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
  const ruth = api.addAccount({
    email: 'ruth@example.org',
    name: 'Ruth Alvarez',
    roles: ['Volunteer'],
  });
  const ws = api.agile.addWorkspace({
    name: 'Toronto team',
    ownerId: grace.profileId,
    memberIds: [ruth.profileId],
  });
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
  const briefs = story('Shelter problem briefs for teams', 'InProgress', 8, true);
  story('Hackathon photo release form', 'ToDo', 2, true);
  const kiosk = story('Volunteer check-in kiosk', 'ToDo', 5, false);
  return { grace, ruth, ws, sprint, briefs, kiosk };
}

test.describe('Sprints', () => {
  test('the backlog shows the active sprint and its history with the average', async ({
    page,
    api,
    axe,
  }) => {
    const { grace, ws } = scrum(api);
    const backlog = new BacklogPage(page);
    await api.signInAs(grace, `/workspaces/${ws.id}/backlog`);

    await expect(backlog.sprint).toContainText('Sprint 7 · Hackathon ready for registration');
    await expect(backlog.sprint).toContainText('Active');
    await expect(backlog.sprint).toContainText('3 stories · 16 points · ends Fri 30 Oct.');
    await expect(backlog.treeView).toHaveAttribute('aria-pressed', 'true');
    await axe.check();

    await backlog.historyView.click();

    await expect(backlog.historyRow('Sprint 6')).toContainText('Venue and date locked');
    await expect(backlog.historyRow('Sprint 6')).toContainText('Tue 6 – Sat 17 Oct');
    await expect(backlog.historyRow('Sprint 6')).toContainText('21 of 23 points');
    await expect(backlog.historyRow('Sprint 5')).toContainText('Tue 22 Sep – Sat 3 Oct');
    await expect(backlog.average).toHaveText('Average: 20 points per sprint.');
    await axe.check();
  });

  test('the owner starts the next sprint, with checks for a goal and at least one story', async ({
    page,
    api,
    axe,
  }) => {
    const { grace, ws, kiosk, briefs } = scrum(api);
    const backlog = new BacklogPage(page);
    await api.signInAs(grace, `/workspaces/${ws.id}/backlog`);

    await backlog.startSprint.click();
    const dialog = new StartSprintDialog(page);
    await expect(dialog.name).toHaveValue('Sprint 8');
    await expect(dialog.story('Volunteer check-in kiosk')).toBeVisible();
    await expect(dialog.stories).toContainText('8 pts · returned from Sprint 7');
    await expect(dialog.average).toContainText('Recent sprints completed 20 points on average.');
    await axe.check();
    await dialog.start.click();
    await expect(
      dialog.error('Write a goal so the team knows what done looks like.'),
    ).toBeVisible();
    await expect(dialog.error('Choose at least one story.')).toBeVisible();

    await dialog.goal.fill('Hackathon weekend runs smoothly');
    await dialog.starts.fill('2026-11-02');
    await dialog.ends.fill('2026-11-13');
    await dialog.story('Volunteer check-in kiosk').check();
    await dialog.story('Shelter problem briefs for teams').check();
    await expect(dialog.stories).toContainText('Stories from the backlog · 13 points');
    await dialog.start.click();

    await expect(dialog.dialog).toBeHidden();
    await expect(backlog.toast).toContainText('Sprint 8 started');
    await expect(backlog.sprint).toContainText('Sprint 8 · Hackathon weekend runs smoothly');
    expect(api.callsTo('POST', `/api/workspaces/${ws.id}/sprints`)[0].body).toEqual({
      name: 'Sprint 8',
      goal: 'Hackathon weekend runs smoothly',
      startDate: '2026-11-02',
      endDate: '2026-11-13',
      storyIds: [briefs.id, kiosk.id],
    });
  });

  test('the owner closes the sprint from the board and unfinished stories go back', async ({
    page,
    api,
    axe,
  }) => {
    const { grace, ws } = scrum(api);
    const board = new BoardPage(page);
    await api.signInAs(grace, `/workspaces/${ws.id}`);

    await board.closeSprint.click();
    const dialog = new CloseSprintDialog(page, 'Sprint 7');
    await expect(dialog.dialog).toContainText(
      '6 of 16 points completed. 2 unfinished stories go back to the backlog and keep their status.',
    );
    await expect(dialog.unfinished).toHaveCount(2);
    await expect(dialog.unfinished.first()).toContainText('Hackathon photo release form');
    await axe.check();
    await dialog.close.click();

    await expect(dialog.dialog).toBeHidden();
    await expect(board.noSprint).toBeVisible();
    await expect(board.startSprint).toBeVisible();
    expect(api.agile.sprints.find((s) => s.name === 'Sprint 7')!.completedPoints).toBe(6);
  });

  test('a member puts a backlog story into the running sprint, but cannot start or close one', async ({
    page,
    api,
  }) => {
    const { ruth, ws, kiosk } = scrum(api);
    const item = new WorkItemPage(page);
    await api.signInAs(ruth, `/workspaces/${ws.id}/items/${kiosk.id}`);

    await item.addToSprint.click();

    await expect(item.toast).toContainText('Added to Sprint 7');
    await expect(item.fact('Sprint')).toContainText('Sprint 7');
    await expect(item.addToSprint).toHaveCount(0);

    const backlog = new BacklogPage(page);
    await backlog.open(ws.id);
    await expect(backlog.sprint).toBeVisible();
    await expect(backlog.startSprint).toHaveCount(0);
    const board = new BoardPage(page);
    await board.open(ws.id);
    await expect(board.card('Volunteer check-in kiosk')).toBeVisible();
    await expect(board.closeSprint).toHaveCount(0);
  });

  test('a Kanban workspace has no sprints', async ({ page, api }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const ws = api.agile.addWorkspace({
      name: 'Hackathon ops',
      method: 'Kanban',
      ownerId: grace.profileId,
    });
    api.agile.addItem({ workspaceId: ws.id, kind: 'Story', title: 'Book AV' });
    const backlog = new BacklogPage(page);

    await api.signInAs(grace, `/workspaces/${ws.id}/backlog`);

    await expect(backlog.link('Book AV')).toBeVisible();
    await expect(backlog.startSprint).toHaveCount(0);
    await expect(backlog.historyView).toHaveCount(0);
  });
});
