import { expect, test } from '../../../e2e/fixtures/app';
import { AppShell } from '../../../e2e/pages/app-shell.page';
import { BacklogPage } from '../../../e2e/pages/backlog.page';
import { BoardPage } from '../../../e2e/pages/board.page';
import { CloseSprintDialog, StartSprintDialog } from '../../../e2e/pages/sprint.dialogs';
import { featuredPhoto } from '../photos';
import { Presenter } from '../presenter';

// Journey: sprints (docs/detailed-designs/agile/sprints, L2-031, L2-035).
test('sprints', async ({ page, api }) => {
  const show = await Presenter.start(page, 'sprints');
  const backlog = new BacklogPage(page);
  const board = new BoardPage(page);
  const shell = new AppShell(page);
  const grace = api.addAccount({
    email: 'grace@example.org',
    name: 'Grace Okonkwo',
    roles: ['CityLead'],
  });
  const marcus = api.addAccount({ email: 'marcus@example.org', name: 'Marcus Lee' });
  const samuel = api.addAccount({ email: 'samuel@example.org', name: 'Samuel Mensah' });
  const hannah = api.addAccount({ email: 'hannah@example.org', name: 'Hannah Kim' });
  // Grace's photo and three unread notices, as the top bar of docs/mocks/pages/backlog shows.
  api.profiles.get(grace.profileId)!.photos.push(featuredPhoto('grace-okonkwo'));
  for (const [title, minutesAgo] of [
    ['Marcus Lee commented on Hackathon registration page', 30],
    ['Samuel Mensah moved Shelter problem briefs for teams', 90],
    ['Hannah Kim joined Toronto team', 300],
  ] as const) {
    api.notifications.add({ recipientId: grace.profileId, title }, minutesAgo);
  }
  const ws = api.agile.addWorkspace({
    name: 'Toronto team',
    ownerId: grace.profileId,
    memberIds: [marcus.profileId, samuel.profileId, hannah.profileId],
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
    endDate: '2026-10-31',
    state: 'Active',
  });

  // The backlog of docs/mocks/pages/backlog/default: an initiative, its epics, their stories and tasks.
  const item = (
    kind: 'Initiative' | 'Epic' | 'Story' | 'Task',
    title: string,
    extra: {
      parentId?: string;
      status?: 'ToDo' | 'InProgress' | 'Done';
      points?: number;
      inSprint?: boolean;
      assigneeId?: string;
    } = {},
  ) =>
    api.agile.addItem({
      workspaceId: ws.id,
      kind,
      title,
      parentId: extra.parentId ?? null,
      status: extra.status ?? 'ToDo',
      isDone: extra.status === 'Done',
      storyPoints: extra.points ?? null,
      sprintId: extra.inSprint ? sprint.id : null,
      assigneeId: extra.assigneeId ?? null,
    });
  const season = item('Initiative', 'Launch the hackathon season');
  const shelters = item('Epic', 'Tech for Shelters hackathon', { parentId: season.id });
  const sponsorships = item('Epic', 'Partner sponsorships', { parentId: season.id });
  const buildersNight = item('Epic', 'Monthly Builders Night');
  // The sprint holds the board's six stories: 24 points, 6 of them done.
  const registration = item('Story', 'Hackathon registration page', {
    parentId: shelters.id,
    status: 'Done',
    points: 5,
    inSprint: true,
  });
  item('Task', 'Write registration copy', {
    parentId: registration.id,
    status: 'Done',
    assigneeId: marcus.profileId,
  });
  item('Task', 'Connect RSVP to public event', {
    parentId: registration.id,
    status: 'Done',
    assigneeId: marcus.profileId,
  });
  const briefs = item('Story', 'Shelter problem briefs for teams', {
    parentId: shelters.id,
    status: 'InProgress',
    points: 8,
    inSprint: true,
  });
  item('Task', 'Interview Harbour Light staff', {
    parentId: briefs.id,
    status: 'Done',
    assigneeId: grace.profileId,
  });
  item('Task', 'Edit six briefs', { parentId: briefs.id, assigneeId: samuel.profileId });
  item('Task', 'Share briefs with teams', { parentId: briefs.id, assigneeId: hannah.profileId });
  item('Story', 'Lantern Foundation grant proposal', { parentId: sponsorships.id });
  item('Story', 'Book AV for Builders Night', { parentId: buildersNight.id, points: 2 });
  item('Story', 'Volunteer check-in kiosk', { status: 'InProgress', points: 5, inSprint: true });
  item('Story', 'Hackathon photo release form', { points: 2, inSprint: true });
  item('Story', 'Judging rubric for Tech for Shelters', {
    status: 'InProgress',
    points: 3,
    inSprint: true,
  });
  item('Story', 'Confirm Trinity Community Centre', { status: 'Done', points: 1, inSprint: true });

  await show.card(
    'opening',
    'opening',
    ['Plan, run and close a sprint', 'Recorded against a local fake API · synthetic people'],
    () => api.signInAs(grace, `/workspaces/${ws.id}/backlog`),
  );

  await show.step('active', async () => {
    await expect(backlog.sprint).toContainText('Sprint 7');
    await expect(backlog.sprint).toContainText('6 stories · 24 points · ends Sat 31 Oct.');
  });

  await show.step('history', async () => {
    await backlog.historyView.click();
    await expect(backlog.historyRow('Sprint 6')).toContainText('21 of 23 points');
    await expect(backlog.average).toHaveText('Average: 20 points per sprint.');
  });

  const close = new CloseSprintDialog(page, 'Sprint 7');
  await show.step('close', async () => {
    await backlog.treeView.click();
    await board.open(ws.id);
    await board.closeSprint.click();
    await expect(close.dialog).toContainText('6 of 24 points completed.');
    await expect(close.unfinished).toHaveCount(4);
  });

  const start = new StartSprintDialog(page);
  await show.step('start-dialog', async () => {
    await close.close.click();
    await expect(close.dialog).toBeHidden();
    await expect(board.noSprint).toBeVisible();
    // Its news told, the "Sprint 7 closed" toast leaves before the next sprint is planned.
    await shell.dismissToast('Sprint 7 closed');
    await board.startSprint.click();
    await expect(start.dialog).toBeVisible();
    await expect(start.name).toHaveValue('Sprint 8');
    await expect(start.average).toContainText('Recent sprints completed');
    await expect(start.stories).toContainText('Stories from the backlog · 20 points');
    await start.starts.fill('2026-11-03');
    await start.ends.fill('2026-11-14');
    await start.start.click();
    await expect(start.error('Write a goal so the team knows what done looks like.')).toBeVisible();
  });

  await show.step(
    'start',
    async () => {
      await start.goal.fill('Hackathon weekend runs smoothly');
      await start.story('Book AV for Builders Night').uncheck();
      await expect(start.stories).toContainText('Stories from the backlog · 18 points');
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
