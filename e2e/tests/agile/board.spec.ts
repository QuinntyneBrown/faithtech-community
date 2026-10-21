// Traces to: L2-031 AC3, AC5, L2-034 (docs/detailed-designs/agile/board)
import { expect, test } from '../../fixtures/app';
import { MockApi, MockAccount } from '../../fixtures/mock-api';
import { BoardPage } from '../../pages/board.page';
import { MoveCardDialog } from '../../pages/move-card.dialog';
import { BREAKPOINTS } from '../../pages/viewport';

function sprintBoard(api: MockApi, method: 'Scrum' | 'Kanban' = 'Scrum') {
  const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
  const samuel = api.addAccount({
    email: 'samuel@example.org',
    name: 'Samuel Mensah',
    roles: ['CreateLead'],
  });
  const ws = api.agile.addWorkspace({
    name: 'Toronto team',
    method,
    ownerId: grace.profileId,
    memberIds: [samuel.profileId],
  });
  const sprint = api.agile.addSprint({ workspaceId: ws.id, name: 'Sprint 7', state: 'Active' });
  const story = (
    title: string,
    status: 'ToDo' | 'InProgress' | 'Done',
    points: number,
    inSprint = true,
  ) =>
    api.agile.addItem({
      workspaceId: ws.id,
      kind: 'Story',
      title,
      status,
      storyPoints: points,
      assigneeId: samuel.profileId,
      sprintId: inSprint ? sprint.id : null,
    });
  const kiosk = story('Volunteer check-in kiosk', 'ToDo', 5);
  for (let i = 0; i < 3; i++)
    api.agile.addItem({
      workspaceId: ws.id,
      kind: 'Task',
      title: `Kiosk task ${i}`,
      parentId: kiosk.id,
    });
  story('Shelter problem briefs for teams', 'InProgress', 13);
  story('Hackathon registration page', 'Done', 6);
  story('Not in this sprint', 'ToDo', 2, false);
  return { grace, samuel, ws, sprint, kiosk };
}

async function signIn(api: MockApi, who: MockAccount, path: string) {
  await api.signInAs(who, path);
}

test.describe('Board', () => {
  test('a Scrum board shows the active sprint’s stories in three columns', async ({
    page,
    api,
    axe,
  }) => {
    const { grace, ws } = sprintBoard(api);
    const board = new BoardPage(page);
    await signIn(api, grace, `/workspaces/${ws.id}`);

    await expect(board.frame.subtitle).toHaveText('Scrum · Sprint 7 · Tue 20 – Sat 31 Oct');
    await expect(board.frame.section('Board')).toHaveAttribute('aria-current', 'page');
    await expect(board.stat('Sprint goal')).toContainText('Hackathon ready for registration');
    await expect(board.stat('Completed points')).toContainText('6 of 24');
    await expect(board.stat('Ends')).toContainText('Sat 31 Oct');
    await expect(board.column('To Do').getByRole('listitem')).toHaveCount(1);
    await expect(board.card('Volunteer check-in kiosk')).toContainText('Story');
    await expect(board.card('Volunteer check-in kiosk')).toContainText(
      'Samuel · 5 pts · 0/3 tasks',
    );
    await expect(board.card('Not in this sprint')).toHaveCount(0);
    await expect(board.memberNote).toHaveCount(0);
    await axe.check();
  });

  test('a member moves a card from the keyboard with the Move button', async ({
    page,
    api,
    axe,
  }) => {
    const { samuel, ws, kiosk } = sprintBoard(api);
    const board = new BoardPage(page);
    await signIn(api, samuel, `/workspaces/${ws.id}`);
    await expect(board.memberNote).toContainText('You’re a member of Grace’s workspace');

    await board.move('Volunteer check-in kiosk').focus();
    await page.keyboard.press('Enter');
    const dialog = new MoveCardDialog(page, 'Volunteer check-in kiosk');
    await expect(dialog.column('To Do')).toBeChecked();
    await axe.check();
    await dialog.column('In Progress').check();
    await dialog.move.click();

    await expect(dialog.dialog).toBeHidden();
    await expect(
      board.column('In Progress').getByRole('link', { name: 'Volunteer check-in kiosk' }),
    ).toBeVisible();
    expect(api.callsTo('PUT', `/api/items/${kiosk.id}/status`)[0].body).toEqual({
      status: 'InProgress',
    });
  });

  test('a member drags a card to another column', async ({ page, api }) => {
    const { samuel, ws, kiosk } = sprintBoard(api);
    const board = new BoardPage(page);
    await signIn(api, samuel, `/workspaces/${ws.id}`);

    await board.drag('Volunteer check-in kiosk', 'Done');

    await expect(
      board.column('Done').getByRole('link', { name: 'Volunteer check-in kiosk' }),
    ).toBeVisible();
    await expect.poll(() => api.agile.items.find((i) => i.id === kiosk.id)!.status).toBe('Done');
  });

  test('another viewer’s move shows up within 2 seconds', async ({ page, api }) => {
    const { grace, ws, kiosk } = sprintBoard(api);
    const board = new BoardPage(page);
    await signIn(api, grace, `/workspaces/${ws.id}`);
    await expect(
      board.column('To Do').getByRole('link', { name: 'Volunteer check-in kiosk' }),
    ).toBeVisible();
    await expect.poll(() => api.agile.boardWatchers(ws.id)).toBe(1);

    api.agile.cardMoved(kiosk.id, 'Done');

    await expect(
      board.column('Done').getByRole('link', { name: 'Volunteer check-in kiosk' }),
    ).toBeVisible({
      timeout: 2000,
    });
  });

  test('a Scrum workspace with no sprint running points to the backlog', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const ws = api.agile.addWorkspace({ name: 'Toronto team', ownerId: grace.profileId });
    const board = new BoardPage(page);

    await signIn(api, grace, `/workspaces/${ws.id}`);

    await expect(board.frame.subtitle).toHaveText('Scrum · no active sprint');
    await expect(board.noSprint).toBeVisible();
    await axe.check();
  });

  test('a Kanban board shows every story and can be narrowed to an epic', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const ws = api.agile.addWorkspace({
      name: 'Hackathon ops',
      method: 'Kanban',
      ownerId: grace.profileId,
    });
    const epic = api.agile.addItem({
      workspaceId: ws.id,
      kind: 'Epic',
      title: 'Partner sponsorships',
    });
    api.agile.addItem({
      workspaceId: ws.id,
      kind: 'Story',
      title: 'Lantern Foundation grant proposal',
      parentId: epic.id,
    });
    api.agile.addItem({
      workspaceId: ws.id,
      kind: 'Story',
      title: 'Book AV for Builders Night',
      status: 'InProgress',
    });
    const board = new BoardPage(page);
    await signIn(api, grace, `/workspaces/${ws.id}`);
    await expect(board.frame.subtitle).toHaveText('Kanban · To Do → In Progress → Done');
    await expect(board.card('Book AV for Builders Night')).toBeVisible();
    await axe.check();

    await board.filter.selectOption({ label: 'Epic: Partner sponsorships' });

    await expect(board.card('Lantern Foundation grant proposal')).toBeVisible();
    await expect(board.card('Book AV for Builders Night')).toHaveCount(0);
  });

  test('Staff see the board but cannot move cards', async ({ page, api, axe }) => {
    const { ws } = sprintBoard(api);
    const daniel = api.addAccount({
      email: 'daniel@example.org',
      name: 'Daniel Reyes',
      roles: ['Staff'],
    });
    const board = new BoardPage(page);

    await signIn(api, daniel, `/workspaces/${ws.id}`);

    await expect(board.frame.readOnly).toBeVisible();
    await expect(board.card('Volunteer check-in kiosk')).toBeVisible();
    await expect(board.move('Volunteer check-in kiosk')).toHaveCount(0);
    await expect(board.newStory).toHaveCount(0);
    await axe.check();
  });

  test('at XS the columns are tabs with one visible at a time', async ({ page, api, axe }) => {
    await page.setViewportSize(BREAKPOINTS.xs);
    const { samuel, ws } = sprintBoard(api);
    const board = new BoardPage(page);
    await signIn(api, samuel, `/workspaces/${ws.id}`);

    await expect(board.columnTab('To Do')).toHaveAttribute('aria-selected', 'true');
    await expect(board.card('Volunteer check-in kiosk')).toBeVisible();
    await expect(board.card('Hackathon registration page')).toBeHidden();
    await axe.check();

    await board.columnTab('To Do').focus();
    await page.keyboard.press('ArrowLeft');

    await expect(board.columnTab('Done')).toHaveAttribute('aria-selected', 'true');
    await expect(board.card('Hackathon registration page')).toBeVisible();
    await expect(board.card('Volunteer check-in kiosk')).toBeHidden();
  });

  test('someone outside the workspace sees nothing of the board', async ({ page, api }) => {
    const { ws } = sprintBoard(api);
    const leah = api.addAccount({
      email: 'leah@example.org',
      name: 'Leah Thompson',
      roles: ['Volunteer'],
    });
    const board = new BoardPage(page);

    await signIn(api, leah, `/workspaces/${ws.id}`);

    await expect(board.frame.notMember).toBeVisible();
    await expect(board.board).toHaveCount(0);
  });
});
