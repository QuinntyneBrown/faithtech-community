// Traces to: L2-031, L2-051 (docs/detailed-designs/agile/workspaces-and-membership)
import { expect, test } from '../../fixtures/app';
import { MockApi } from '../../fixtures/mock-api';
import {
  AddWorkspaceMembersDialog,
  RemoveWorkspaceMemberDialog,
} from '../../pages/workspace-members.dialogs';
import { WorkspaceSettingsPage } from '../../pages/workspace-settings.page';

function cast(api: MockApi) {
  const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
  const ruth = api.addAccount({
    email: 'ruth@example.org',
    name: 'Ruth Alvarez',
    roles: ['Volunteer'],
  });
  const marcus = api.addAccount({
    email: 'marcus@example.org',
    name: 'Marcus Lee',
    roles: ['EventLead'],
  });
  const workspace = api.agile.addWorkspace({
    name: 'Toronto team',
    ownerId: grace.profileId,
    memberIds: [ruth.profileId],
  });
  return { grace, ruth, marcus, workspace };
}

test.describe('Workspace settings', () => {
  test('the owner renames the workspace, and an empty name is caught', async ({
    page,
    api,
    axe,
  }) => {
    const { grace, workspace } = cast(api);
    const settings = new WorkspaceSettingsPage(page);
    await api.signInAs(grace, `/workspaces/${workspace.id}/settings`);
    await expect(settings.frame.heading).toHaveText('Toronto team');
    await expect(settings.frame.subtitle).toHaveText(
      'Settings · only you, the owner, can change these',
    );
    await axe.check();

    await settings.name.fill('');
    await settings.save.click();
    await expect(settings.errorSummary).toBeFocused();
    await expect(settings.nameError).toBeVisible();
    await axe.check();

    await settings.name.fill('Toronto city team');
    await settings.save.click();

    await expect(settings.toast).toContainText('Settings saved');
    await expect(settings.frame.heading).toHaveText('Toronto city team');
    expect(api.agile.workspaces[0].name).toBe('Toronto city team');
  });

  test('the owner adds members from the leads and volunteers', async ({ page, api, axe }) => {
    const { grace, marcus, workspace } = cast(api);
    api.addAccount({ email: 'jonah@example.org', name: 'Jonah Bell', roles: ['Attendee'] });
    const settings = new WorkspaceSettingsPage(page);
    await api.signInAs(grace, `/workspaces/${workspace.id}/settings`);
    await expect(settings.membersHeading).toHaveText('Members (2)');

    await settings.addMembers.click();
    const dialog = new AddWorkspaceMembersDialog(page, 'Toronto team');
    await expect(dialog.person('Marcus Lee')).toBeVisible();
    await expect(dialog.person('Jonah Bell')).toHaveCount(0);
    await expect(dialog.person('Ruth Alvarez')).toHaveCount(0);
    await axe.check();
    await dialog.add.click();
    await expect(dialog.noneChosen).toBeVisible();

    await dialog.person('Marcus Lee').check();
    await dialog.add.click();

    await expect(dialog.dialog).toBeHidden();
    await expect(settings.toast).toContainText('Marcus Lee added');
    await expect(settings.member('Marcus Lee')).toContainText('Event Lead');
    await expect(settings.membersHeading).toHaveText('Members (3)');
    expect(api.callsTo('POST', `/api/workspaces/${workspace.id}/members`)[0].body).toEqual({
      profileIds: [marcus.profileId],
    });
  });

  test('the owner removes a member after confirming', async ({ page, api, axe }) => {
    const { grace, workspace } = cast(api);
    const settings = new WorkspaceSettingsPage(page);
    await api.signInAs(grace, `/workspaces/${workspace.id}/settings`);
    await expect(settings.member('Grace Okonkwo')).toContainText('Grace Okonkwo (you, owner)');
    await expect(settings.remove('Grace Okonkwo')).toHaveCount(0);

    await settings.remove('Ruth Alvarez').click();
    const dialog = new RemoveWorkspaceMemberDialog(page, 'Ruth Alvarez', 'Toronto team');
    await expect(dialog.dialog).toContainText('Ruth Alvarez loses access straight away.');
    await axe.check();
    await dialog.remove.click();

    await expect(dialog.dialog).toBeHidden();
    await expect(settings.toast).toContainText('Ruth Alvarez removed');
    await expect(settings.member('Ruth Alvarez')).toHaveCount(0);
  });

  test('a member who is not the owner sees that only the owner changes settings', async ({
    page,
    api,
    axe,
  }) => {
    const { ruth, workspace } = cast(api);
    const settings = new WorkspaceSettingsPage(page);

    await api.signInAs(ruth, `/workspaces/${workspace.id}/settings`);

    await expect(settings.ownerOnly).toBeVisible();
    await expect(settings.frame.section('Settings')).toHaveCount(0);
    await expect(settings.addMembers).toHaveCount(0);
    await axe.check();
  });

  test('someone outside the workspace is told they are not a member', async ({
    page,
    api,
    axe,
  }) => {
    const { workspace } = cast(api);
    const leah = api.addAccount({
      email: 'leah@example.org',
      name: 'Leah Thompson',
      roles: ['Volunteer'],
    });
    const settings = new WorkspaceSettingsPage(page);

    await api.signInAs(leah, `/workspaces/${workspace.id}/settings`);

    await expect(settings.frame.notMember).toBeVisible();
    await axe.check();
  });
});
