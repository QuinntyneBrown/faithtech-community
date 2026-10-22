import { expect, test } from '../../../e2e/fixtures/app';
import { AdminUsersPage } from '../../../e2e/pages/admin-users.page';
import {
  ArchiveWorkItemDialog,
  ArchiveWorkspaceDialog,
  ReassignOwnerDialog,
} from '../../../e2e/pages/archive.dialogs';
import { BacklogPage } from '../../../e2e/pages/backlog.page';
import { WorkItemPage } from '../../../e2e/pages/work-item.page';
import { WorkspaceSettingsPage } from '../../../e2e/pages/workspace-settings.page';
import { WorkspacesPage } from '../../../e2e/pages/workspaces.page';
import { Presenter } from '../presenter';

// Journey: archive and transfer workspaces (docs/detailed-designs/agile/archive-and-transfer-workspaces, L2-037).
test('archive-and-transfer-workspaces', async ({ page, api }) => {
  const show = await Presenter.start(page, 'archive-and-transfer-workspaces');
  const item = new WorkItemPage(page);
  const backlog = new BacklogPage(page);
  const settings = new WorkspaceSettingsPage(page);
  const workspaces = new WorkspacesPage(page);
  const admin = new AdminUsersPage(page);
  const grace = api.addAccount({
    email: 'grace@example.org',
    name: 'Grace Okonkwo',
    roles: ['CityLead'],
  });
  const ws = api.agile.addWorkspace({ name: 'Toronto team', ownerId: grace.profileId });
  api.agile.addWorkspace({ name: 'Hackathon ops', method: 'Kanban', ownerId: grace.profileId });
  const story = api.agile.addItem({
    workspaceId: ws.id,
    kind: 'Story',
    title: 'Shelter problem briefs',
  });
  api.agile.addItem({
    workspaceId: ws.id,
    kind: 'Task',
    title: 'Draft the brief',
    parentId: story.id,
  });

  await show.card(
    'opening',
    'opening',
    ['Archive work, and hand it on', 'Recorded against a local fake API · synthetic people'],
    () => api.signInAs(grace, `/workspaces/${ws.id}/items/${story.id}`),
  );

  await show.step('archive-item', async () => {
    await item.archive.click();
    const dialog = new ArchiveWorkItemDialog(page, 'Shelter problem briefs');
    await expect(dialog.dialog).toContainText('Its 1 task is archived with it.');
    await dialog.confirm.click();
    await expect(backlog.toast).toContainText('archived');
  });

  await show.step('restore-item', async () => {
    await settings.open(ws.id);
    await expect(settings.archivedItems).toHaveCount(1);
    await settings.restore('Shelter problem briefs').click();
    await expect(settings.toast).toContainText('restored');
    await expect(settings.archivedItems).toHaveCount(0);
  });

  await show.step('archive-workspace', async () => {
    await settings.archiveWorkspace.click();
    const dialog = new ArchiveWorkspaceDialog(page, 'Toronto team');
    await expect(dialog.dialog).toContainText('Members lose access.');
    await dialog.confirm.click();
    await expect(workspaces.archived).toHaveCount(1);
  });

  await show.step('restore-workspace', async () => {
    await workspaces.restore('Toronto team').click();
    await expect(workspaces.archived).toHaveCount(0);
    await expect(workspaces.link('Toronto team')).toBeVisible();
  });

  await show.step(
    'owner-lost-role',
    async () => {
      const priya = api.addAccount({
        email: 'priya@example.org',
        name: 'Priya Shah',
        roles: ['SystemAdmin'],
      });
      api.addAccount({ email: 'joel@example.org', name: 'Joel Mbeki', roles: ['CityLead'] });
      const kofi = api.addAccount({
        email: 'kofi@example.org',
        name: 'Kofi Mensah',
        roles: ['Volunteer'],
      });
      api.agile.addWorkspace({ name: 'Austin team', ownerId: kofi.profileId });
      await api.signInAs(priya, '/admin/users');
      await expect(admin.needsOwner).toContainText('no longer holds the City Lead role');
    },
    { poster: true },
  );

  await show.step('reassign', async () => {
    await admin.workspaceSettings('Austin team').click();
    await expect(settings.needsOwner).toBeVisible();
    await settings.reassignOwner.click();
    const dialog = new ReassignOwnerDialog(page, 'Austin team');
    await dialog.owner.selectOption({ label: 'Joel Mbeki' });
    await dialog.confirm.click();
    await expect(dialog.dialog).toBeHidden();
    await expect(settings.toast).toContainText('Joel Mbeki now owns Austin team');
  });

  await show.card('closing', 'closing', [
    'Archive instead of delete',
    'Everything can be restored',
    'A System Admin can hand a workspace to a new owner',
  ]);
  await show.finish();
});
