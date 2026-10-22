import { expect, test } from '../../../e2e/fixtures/app';
import { BoardPage } from '../../../e2e/pages/board.page';
import { SwitchMethodDialog } from '../../../e2e/pages/switch-method.dialog';
import { WorkspaceSettingsPage } from '../../../e2e/pages/workspace-settings.page';
import { Presenter } from '../presenter';

// Journey: switch between Scrum and Kanban (docs/detailed-designs/agile/switch-method, L2-036).
test('switch-method', async ({ page, api }) => {
  const show = await Presenter.start(page, 'switch-method');
  const settings = new WorkspaceSettingsPage(page);
  const board = new BoardPage(page);
  const grace = api.addAccount({
    email: 'grace@example.org',
    name: 'Grace Okonkwo',
    roles: ['CityLead'],
  });
  const ws = api.agile.addWorkspace({ name: 'Toronto team', ownerId: grace.profileId });
  const sprint = api.agile.addSprint({ workspaceId: ws.id, name: 'Sprint 7', state: 'Active' });
  api.agile.addItem({
    workspaceId: ws.id,
    kind: 'Story',
    title: 'Shelter briefs',
    status: 'InProgress',
    sprintId: sprint.id,
  });

  await show.card(
    'opening',
    'opening',
    ['Switch between Scrum and Kanban', 'Recorded against a local fake API · synthetic people'],
    () => api.signInAs(grace, `/workspaces/${ws.id}/settings`),
  );

  await show.step('method', async () => {
    await expect(settings.method).toContainText('Scrum');
    await expect(settings.switchTo('Kanban')).toBeVisible();
  });

  const toKanban = new SwitchMethodDialog(page, 'Toronto team', 'Kanban');
  await show.step('warning', async () => {
    await settings.switchTo('Kanban').click();
    await expect(toKanban.dialog).toContainText('Items keep their status.');
    await expect(toKanban.dialog).toContainText('closes Sprint 7');
  });

  await show.step(
    'kanban',
    async () => {
      await toKanban.confirm.click();
      await expect(toKanban.dialog).toBeHidden();
      await expect(settings.method).toContainText('Kanban');
      await board.open(ws.id);
      await expect(board.frame.subtitle).toHaveText('Kanban · To Do → In Progress → Done');
      await expect(
        board.column('In Progress').getByRole('link', { name: 'Shelter briefs' }),
      ).toBeVisible();
    },
    { poster: true },
  );

  await show.step('back', async () => {
    await settings.open(ws.id);
    await settings.switchTo('Scrum').click();
    const toScrum = new SwitchMethodDialog(page, 'Toronto team', 'Scrum');
    await expect(toScrum.dialog).toContainText('goes to the backlog');
    await toScrum.confirm.click();
    await expect(toScrum.dialog).toBeHidden();
    await expect(settings.method).toContainText('Scrum');
  });

  await show.card('closing', 'closing', [
    'Scrum or Kanban, your choice',
    'Items keep their status when you switch',
  ]);
  await show.finish();
});
