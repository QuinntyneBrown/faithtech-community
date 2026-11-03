import { expect, test } from '../../../e2e/fixtures/app';
import { BoardPage } from '../../../e2e/pages/board.page';
import { MoveCardDialog } from '../../../e2e/pages/move-card.dialog';
import { featuredPhoto } from '../photos';
import { Presenter } from '../presenter';

// Journey: the board (docs/detailed-designs/agile/board, L2-031, L2-034).
test('board', async ({ page, api }) => {
  const show = await Presenter.start(page, 'board');
  const board = new BoardPage(page);
  const grace = api.addAccount({
    email: 'grace@example.org',
    name: 'Grace Okonkwo',
    roles: ['CityLead'],
  });
  const samuel = api.addAccount({
    email: 'samuel@example.org',
    name: 'Samuel Mensah',
    roles: ['CreateLead'],
  });
  const ws = api.agile.addWorkspace({
    name: 'Toronto team',
    ownerId: grace.profileId,
    memberIds: [samuel.profileId],
  });
  const ruth = api.addAccount({ email: 'ruth@example.org', name: 'Ruth Alvarez' });
  const marcus = api.addAccount({ email: 'marcus@example.org', name: 'Marcus Lee' });
  // Samuel's photo and three unread notices, as the top bar of docs/mocks/pages/team-board shows.
  api.profiles.get(samuel.profileId)!.photos.push(featuredPhoto('samuel-mensah'));
  for (const [title, minutesAgo] of [
    ['Grace Okonkwo assigned you Volunteer check-in kiosk', 30],
    ['Grace Okonkwo added you to Toronto team', 90],
    ['Your roles changed', 300],
  ] as const) {
    api.notifications.add({ recipientId: samuel.profileId, title }, minutesAgo);
  }
  const sprint = api.agile.addSprint({ workspaceId: ws.id, name: 'Sprint 7', state: 'Active' });
  // The mock's six stories: 24 points, 6 of them done, two in each column.
  const story = (
    title: string,
    status: 'ToDo' | 'InProgress' | 'Done',
    points: number,
    assigneeId: string,
    tasks: [done: number, total: number],
  ) => {
    const item = api.agile.addItem({
      workspaceId: ws.id,
      kind: 'Story',
      title,
      status,
      storyPoints: points,
      assigneeId,
      sprintId: sprint.id,
    });
    for (let i = 0; i < tasks[1]; i++) {
      api.agile.addItem({
        workspaceId: ws.id,
        kind: 'Task',
        title: `${title} task ${i + 1}`,
        parentId: item.id,
        isDone: i < tasks[0],
      });
    }
    return item;
  };
  // A column lists its cards by title, as BoardHandler does.
  const movedByAnother = story('Hackathon photo release form', 'ToDo', 2, ruth.profileId, [0, 1]);
  story('Volunteer check-in kiosk', 'ToDo', 5, samuel.profileId, [0, 3]);
  story('Judging rubric for Tech for Shelters', 'InProgress', 3, samuel.profileId, [2, 4]);
  story('Shelter problem briefs for teams', 'InProgress', 8, grace.profileId, [1, 3]);
  story('Confirm Trinity Community Centre', 'Done', 1, grace.profileId, [1, 1]);
  story('Hackathon registration page', 'Done', 5, marcus.profileId, [2, 2]);

  await show.card(
    'opening',
    'opening',
    ['Run the sprint on the board', 'Recorded against a local fake API · synthetic people'],
    () => api.signInAs(samuel, `/workspaces/${ws.id}`),
  );

  await show.step(
    'board',
    async () => {
      await expect(board.frame.subtitle).toHaveText(/^Scrum · Sprint 7/);
      await expect(board.stat('Sprint goal')).toContainText('Hackathon ready for registration');
      await expect(board.stat('Completed points')).toContainText('6 of 24');
      await expect(board.column('To Do').getByRole('listitem')).toHaveCount(2);
      await expect(board.card('Volunteer check-in kiosk')).toContainText('0/3 tasks');
    },
    { poster: true },
  );

  await show.step('keyboard-move', async () => {
    await board.move('Volunteer check-in kiosk').focus();
    await page.keyboard.press('Enter');
    const dialog = new MoveCardDialog(page, 'Volunteer check-in kiosk');
    await expect(dialog.column('To Do')).toBeChecked();
    // Keys only, as a keyboard user would: the arrow picks the column and Enter moves the card.
    await dialog.column('To Do').focus();
    await page.keyboard.press('ArrowDown');
    await expect(dialog.column('In Progress')).toBeChecked();
    await dialog.move.focus();
    await page.keyboard.press('Enter');
    await expect(dialog.dialog).toBeHidden();
    await expect(
      board.column('In Progress').getByRole('link', { name: 'Volunteer check-in kiosk' }),
    ).toBeVisible();
  });

  // The step ends mid-drag, so its frame shows the lifted card over Done; the drop lands as the next step starts.
  await show.step('drag', async () => {
    await board.startDrag('Shelter problem briefs for teams', 'Done');
  });

  await show.step('live', async () => {
    await board.drop();
    await expect(
      board.column('Done').getByRole('link', { name: 'Shelter problem briefs for teams' }),
    ).toBeVisible();
    await expect.poll(() => api.agile.boardWatchers(ws.id)).toBe(1);
    api.agile.cardMoved(movedByAnother.id, 'InProgress');
    await expect(
      board.column('In Progress').getByRole('link', { name: 'Hackathon photo release form' }),
    ).toBeVisible({ timeout: 3000 });
  });

  await show.card('closing', 'closing', [
    'Three columns for the active sprint',
    'Move cards by dragging or from the keyboard',
    'Everyone sees changes live',
  ]);
  await show.finish();
});
