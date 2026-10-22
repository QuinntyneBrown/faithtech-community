import { expect, test } from '../../../e2e/fixtures/app';
import { CreateWorkspaceDialog } from '../../../e2e/pages/create-workspace.dialog';
import {
  AddWorkspaceMembersDialog,
  RemoveWorkspaceMemberDialog,
} from '../../../e2e/pages/workspace-members.dialogs';
import { WorkspaceSettingsPage } from '../../../e2e/pages/workspace-settings.page';
import { WorkspacesPage } from '../../../e2e/pages/workspaces.page';
import { Presenter } from '../presenter';

// Journey: workspaces and membership (docs/detailed-designs/agile/workspaces-and-membership, L2-031, L2-050, L2-051).
test('workspaces-and-membership', async ({ page, api }) => {
  const show = await Presenter.start(page, 'workspaces-and-membership');
  const workspaces = new WorkspacesPage(page);
  const settings = new WorkspaceSettingsPage(page);
  const grace = api.addAccount({
    email: 'grace@example.org',
    name: 'Grace Okonkwo',
    roles: ['CityLead'],
  });
  api.addAccount({ email: 'ruth@example.org', name: 'Ruth Alvarez', roles: ['Volunteer'] });
  api.addAccount({ email: 'marcus@example.org', name: 'Marcus Lee', roles: ['EventLead'] });
  api.addAccount({ email: 'jonah@example.org', name: 'Jonah Bell', roles: ['Attendee'] });

  await show.card(
    'opening',
    'opening',
    ['Workspaces for your team', 'Recorded against a local fake API · synthetic people'],
    () => api.signInAs(grace, '/workspaces'),
  );

  await show.step('empty', async () => {
    await expect(workspaces.empty).toBeVisible();
    await expect(workspaces.newWorkspace).toBeVisible();
  });

  const create = new CreateWorkspaceDialog(page);
  await show.step('create', async () => {
    await workspaces.newWorkspace.click();
    await expect(create.member('Ruth Alvarez')).toBeVisible();
    await expect(create.member('Jonah Bell')).toHaveCount(0);
    await create.create.click();
    await expect(create.nameError).toBeVisible();
  });

  await show.step(
    'created',
    async () => {
      await create.name.fill('Toronto team');
      await create.method('Scrum').check();
      await create.member('Ruth Alvarez').check();
      await create.create.click();
      await expect(create.dialog).toBeHidden();
      await expect(workspaces.item('Toronto team')).toContainText('2 members');
    },
    { poster: true },
  );

  await show.step('settings', async () => {
    await workspaces.link('Toronto team').click();
    await settings.frame.section('Settings').click();
    await expect(settings.membersHeading).toHaveText('Members (2)');
  });

  await show.step('add-member', async () => {
    await settings.addMembers.click();
    const add = new AddWorkspaceMembersDialog(page, 'Toronto team');
    await expect(add.person('Marcus Lee')).toBeVisible();
    await add.person('Marcus Lee').check();
    await add.add.click();
    await expect(add.dialog).toBeHidden();
    await expect(settings.member('Marcus Lee')).toContainText('Event Lead');
  });

  await show.step('remove-member', async () => {
    await settings.remove('Ruth Alvarez').click();
    const remove = new RemoveWorkspaceMemberDialog(page, 'Ruth Alvarez', 'Toronto team');
    await expect(remove.dialog).toBeVisible();
    await remove.remove.click();
    await expect(remove.dialog).toBeHidden();
    await expect(settings.member('Ruth Alvarez')).toHaveCount(0);
  });

  await show.card('closing', 'closing', [
    'The owner creates the workspace and chooses its members',
    'Members see the workspace; everyone else does not',
  ]);
  await show.finish();
});
