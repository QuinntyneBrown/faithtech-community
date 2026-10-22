// Traces to: L2-037 (docs/detailed-designs/agile/archive-and-transfer-workspaces)
import { expect, test } from '../../fixtures/app';
import { AdminUsersPage } from '../../pages/admin-users.page';
import {
  ArchiveWorkItemDialog,
  ArchiveWorkspaceDialog,
  ReassignOwnerDialog,
} from '../../pages/archive.dialogs';
import { BacklogPage } from '../../pages/backlog.page';
import { WorkItemPage } from '../../pages/work-item.page';
import { WorkspaceSettingsPage } from '../../pages/workspace-settings.page';
import { WorkspacesPage } from '../../pages/workspaces.page';

test.describe('Archive and ownership', () => {
  test('the owner archives a story with its tasks and restores it from settings', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const ws = api.agile.addWorkspace({ name: 'Toronto team', ownerId: grace.profileId });
    const story = api.agile.addItem({
      workspaceId: ws.id,
      kind: 'Story',
      title: 'Shelter problem briefs',
    });
    const task = api.agile.addItem({
      workspaceId: ws.id,
      kind: 'Task',
      title: 'Draft the brief',
      parentId: story.id,
    });
    const item = new WorkItemPage(page);
    await api.signInAs(grace, `/workspaces/${ws.id}/items/${story.id}`);

    await item.archive.click();
    const dialog = new ArchiveWorkItemDialog(page, 'Shelter problem briefs');
    await expect(dialog.dialog).toContainText(
      'Its 1 task is archived with it. The owner can restore it from workspace settings.',
    );
    await axe.check();
    await dialog.confirm.click();

    const backlog = new BacklogPage(page);
    await expect(page).toHaveURL(`/workspaces/${ws.id}/backlog`);
    await expect(backlog.toast).toContainText('“Shelter problem briefs” archived');
    expect(task.isArchived).toBe(true);

    const settings = new WorkspaceSettingsPage(page);
    await settings.open(ws.id);
    await expect(settings.archivedItems).toHaveCount(1);
    await expect(settings.archivedItems.first()).toContainText('Shelter problem briefs');
    await expect(settings.archivedItems.first()).toContainText(
      'Archived Wed 21 Oct by Grace Okonkwo',
    );
    await axe.check();
    await settings.restore('Shelter problem briefs').click();

    await expect(settings.toast).toContainText('“Shelter problem briefs” restored');
    await expect(settings.archivedItems).toHaveCount(0);
    expect(task.isArchived).toBe(false);
  });

  test('a member sees no Archive action on an item', async ({ page, api }) => {
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
    const story = api.agile.addItem({ workspaceId: ws.id, kind: 'Story', title: 'Kiosk' });
    const item = new WorkItemPage(page);

    await api.signInAs(ruth, `/workspaces/${ws.id}/items/${story.id}`);

    await expect(item.edit).toBeVisible();
    await expect(item.archive).toHaveCount(0);
  });

  test('the owner archives the workspace and restores it from Workspaces', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const ws = api.agile.addWorkspace({ name: 'Toronto team', ownerId: grace.profileId });
    api.agile.addWorkspace({ name: 'Hackathon ops', method: 'Kanban', ownerId: grace.profileId });
    const settings = new WorkspaceSettingsPage(page);
    await api.signInAs(grace, `/workspaces/${ws.id}/settings`);

    await settings.archiveWorkspace.click();
    const dialog = new ArchiveWorkspaceDialog(page, 'Toronto team');
    await expect(dialog.dialog).toContainText(
      'Members lose access. Everything is kept, and you can restore it from Workspaces.',
    );
    await axe.check();
    await dialog.confirm.click();

    const workspaces = new WorkspacesPage(page);
    await expect(page).toHaveURL('/workspaces');
    await expect(workspaces.toast).toContainText('Toronto team archived');
    await expect(workspaces.items).toHaveCount(1);
    await expect(workspaces.archived).toHaveCount(1);
    await expect(workspaces.archived.first()).toContainText('Toronto team');
    await axe.check();

    await workspaces.restore('Toronto team').click();
    await expect(workspaces.toast).toContainText('Toronto team restored');
    await expect(workspaces.archived).toHaveCount(0);
    await expect(workspaces.link('Toronto team')).toBeVisible();
  });

  test('System Admin reassigns a workspace whose owner lost City Lead', async ({
    page,
    api,
    axe,
  }) => {
    const priya = api.addAccount({
      email: 'priya@example.org',
      name: 'Priya Shah',
      roles: ['SystemAdmin'],
    });
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['Volunteer'] });
    const joel = api.addAccount({
      email: 'joel@example.org',
      name: 'Joel Mbeki',
      roles: ['CityLead'],
    });
    const ws = api.agile.addWorkspace({ name: 'Toronto team', ownerId: grace.profileId });
    const admin = new AdminUsersPage(page);
    await api.signInAs(priya, '/admin/users');

    await expect(admin.needsOwner).toContainText(
      'Grace Okonkwo no longer holds the City Lead role but owns Toronto team.',
    );
    await axe.check();
    await admin.workspaceSettings('Toronto team').click();

    const settings = new WorkspaceSettingsPage(page);
    await expect(page).toHaveURL(`/workspaces/${ws.id}/settings`);
    await expect(settings.needsOwner).toBeVisible();
    await axe.check();
    await settings.reassignOwner.click();

    const dialog = new ReassignOwnerDialog(page, 'Toronto team');
    await dialog.confirm.click();
    await expect(dialog.ownerError).toBeVisible();
    await dialog.owner.selectOption({ label: 'Joel Mbeki' });
    await axe.check();
    await dialog.confirm.click();

    await expect(dialog.dialog).toBeHidden();
    await expect(settings.toast).toContainText('Joel Mbeki now owns Toronto team');
    await expect(settings.needsOwner).toBeHidden();
    await expect(settings.member('Grace Okonkwo')).toBeVisible();
    expect(api.callsTo('PUT', `/api/workspaces/${ws.id}/owner`)[0].body).toEqual({
      ownerId: joel.profileId,
    });
  });
});
