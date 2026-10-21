// Traces to: L2-036 (docs/detailed-designs/agile/switch-method)
import { expect, test } from '../../fixtures/app';
import { BoardPage } from '../../pages/board.page';
import { SwitchMethodDialog } from '../../pages/switch-method.dialog';
import { WorkspaceSettingsPage } from '../../pages/workspace-settings.page';

test.describe('Switch method', () => {
  test('the owner switches Scrum to Kanban, which closes the running sprint', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const ws = api.agile.addWorkspace({ name: 'Toronto team', ownerId: grace.profileId });
    const sprint = api.agile.addSprint({ workspaceId: ws.id, name: 'Sprint 7', state: 'Active' });
    api.agile.addItem({
      workspaceId: ws.id,
      kind: 'Story',
      title: 'Shelter briefs',
      status: 'InProgress',
      sprintId: sprint.id,
    });
    const settings = new WorkspaceSettingsPage(page);
    await api.signInAs(grace, `/workspaces/${ws.id}/settings`);
    await expect(settings.method).toContainText('Scrum');

    await settings.switchTo('Kanban').click();
    const dialog = new SwitchMethodDialog(page, 'Toronto team', 'Kanban');
    await expect(dialog.dialog).toContainText(
      'Items keep their status. Switching to Kanban closes Sprint 7, and its unfinished stories return to the backlog.',
    );
    await axe.check();
    await dialog.confirm.click();

    await expect(dialog.dialog).toBeHidden();
    await expect(settings.toast).toContainText('Toronto team now uses Kanban');
    await expect(settings.method).toContainText('Kanban');
    expect(api.agile.sprints[0].state).toBe('Closed');

    const board = new BoardPage(page);
    await board.open(ws.id);
    await expect(board.frame.subtitle).toHaveText('Kanban · To Do → In Progress → Done');
    await expect(
      board.column('In Progress').getByRole('link', { name: 'Shelter briefs' }),
    ).toBeVisible();
  });

  test('the owner switches Kanban to Scrum, and stories not Done wait in the backlog', async ({
    page,
    api,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const ws = api.agile.addWorkspace({
      name: 'Hackathon ops',
      method: 'Kanban',
      ownerId: grace.profileId,
    });
    const settings = new WorkspaceSettingsPage(page);
    await api.signInAs(grace, `/workspaces/${ws.id}/settings`);

    await settings.switchTo('Scrum').click();
    const dialog = new SwitchMethodDialog(page, 'Hackathon ops', 'Scrum');
    await expect(dialog.dialog).toContainText('Every story that isn’t Done goes to the backlog');
    await dialog.confirm.click();

    await expect(settings.method).toContainText('Scrum');
    expect(api.callsTo('PUT', `/api/workspaces/${ws.id}/method`)[0].body).toEqual({
      method: 'Scrum',
    });
  });
});
