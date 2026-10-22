import { expect, test } from '../../../e2e/fixtures/app';
import { BoardPage } from '../../../e2e/pages/board.page';
import { MoveCardDialog } from '../../../e2e/pages/move-card.dialog';
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
  const sprint = api.agile.addSprint({ workspaceId: ws.id, name: 'Sprint 7', state: 'Active' });
  const story = (title: string, status: 'ToDo' | 'InProgress' | 'Done', points: number) =>
    api.agile.addItem({
      workspaceId: ws.id,
      kind: 'Story',
      title,
      status,
      storyPoints: points,
      assigneeId: samuel.profileId,
      sprintId: sprint.id,
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
  const movedByAnother = story('Printed name badges', 'ToDo', 3);

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
      await expect(board.stat('Completed points')).toContainText('6 of 27');
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
    await dialog.column('In Progress').check();
    await dialog.move.click();
    await expect(dialog.dialog).toBeHidden();
    await expect(
      board.column('In Progress').getByRole('link', { name: 'Volunteer check-in kiosk' }),
    ).toBeVisible();
  });

  await show.step('drag', async () => {
    await board.drag('Shelter problem briefs for teams', 'Done');
    await expect(
      board.column('Done').getByRole('link', { name: 'Shelter problem briefs for teams' }),
    ).toBeVisible();
  });

  await show.step('live', async () => {
    await expect.poll(() => api.agile.boardWatchers(ws.id)).toBe(1);
    api.agile.cardMoved(movedByAnother.id, 'InProgress');
    await expect(
      board.column('In Progress').getByRole('link', { name: 'Printed name badges' }),
    ).toBeVisible({ timeout: 3000 });
  });

  await show.card('closing', 'closing', [
    'Three columns for the active sprint',
    'Move cards by dragging or from the keyboard',
    'Everyone sees changes live',
  ]);
  await show.finish();
});
