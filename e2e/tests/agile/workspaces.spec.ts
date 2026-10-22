// Traces to: L2-031, L2-050 (docs/detailed-designs/agile/workspaces-and-membership)
import { expect, test } from '../../fixtures/app';
import { CreateWorkspaceDialog } from '../../pages/create-workspace.dialog';
import { WorkspacesPage } from '../../pages/workspaces.page';

test.describe('Workspaces', () => {
  test('a City Lead sees the workspaces they own and belong to', async ({ page, api, axe }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const esther = api.addAccount({
      email: 'esther@example.org',
      name: 'Esther Nakamura',
      roles: ['CityLead'],
    });
    const ruth = api.addAccount({
      email: 'ruth@example.org',
      name: 'Ruth Alvarez',
      roles: ['Volunteer'],
    });
    const toronto = api.agile.addWorkspace({
      name: 'Toronto team',
      ownerId: grace.profileId,
      memberIds: [ruth.profileId],
    });
    api.agile.addSprint({ workspaceId: toronto.id, name: 'Sprint 7', state: 'Active' });
    api.agile.addWorkspace({ name: 'Hackathon ops', method: 'Kanban', ownerId: grace.profileId });
    api.agile.addWorkspace({
      name: 'Austin city team',
      ownerId: esther.profileId,
      memberIds: [grace.profileId],
    });
    api.agile.addWorkspace({ name: 'Not Grace’s', ownerId: esther.profileId });
    const workspaces = new WorkspacesPage(page);

    await api.signInAs(grace, '/workspaces');

    await expect(workspaces.heading).toHaveText('Workspaces');
    await expect(workspaces.items).toHaveCount(3);
    await expect(workspaces.item('Toronto team')).toContainText(
      'Owner: Grace Okonkwo · Scrum · Sprint 7 active · 2 members',
    );
    await expect(workspaces.ownerBadge('Toronto team')).toHaveText('Owner');
    await expect(workspaces.ownerBadge('Austin city team')).toHaveCount(0);
    await expect(workspaces.item('Hackathon ops')).toContainText('Kanban · 1 member');
    await expect(workspaces.item('Austin city team')).toContainText(
      'Owner: Esther Nakamura · Scrum · no active sprint',
    );
    await expect(workspaces.link('Not Grace’s')).toHaveCount(0);
    await axe.check();
  });

  test('a City Lead with no workspace creates one with members', async ({ page, api, axe }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const marcus = api.addAccount({
      email: 'marcus@example.org',
      name: 'Marcus Lee',
      roles: ['EventLead'],
    });
    api.addAccount({ email: 'ruth@example.org', name: 'Ruth Alvarez', roles: ['Volunteer'] });
    api.addAccount({ email: 'jonah@example.org', name: 'Jonah Bell', roles: ['Attendee'] });
    const workspaces = new WorkspacesPage(page);
    await api.signInAs(grace, '/workspaces');
    await expect(workspaces.empty).toBeVisible();
    await axe.check();

    await workspaces.newWorkspace.click();
    const dialog = new CreateWorkspaceDialog(page);
    await expect(dialog.member('Marcus Lee')).toBeVisible();
    await expect(dialog.member('Ruth Alvarez')).toBeVisible();
    await expect(dialog.member('Jonah Bell')).toHaveCount(0);
    await axe.check();
    await dialog.create.click();
    await expect(dialog.nameError).toBeVisible();
    await expect(dialog.name).toBeFocused();

    await dialog.name.fill('Hackathon ops');
    await dialog.method('Kanban').check();
    await dialog.member('Marcus Lee').check();
    await dialog.create.click();

    await expect(dialog.dialog).toBeHidden();
    await expect(workspaces.toast).toContainText('Hackathon ops created');
    await expect(workspaces.item('Hackathon ops')).toContainText('Kanban · 2 members');
    expect(api.callsTo('POST', '/api/workspaces')[0].body).toEqual({
      name: 'Hackathon ops',
      method: 'Kanban',
      memberIds: [marcus.profileId],
    });
  });

  test('the create dialog keeps what was typed when the request fails', async ({ page, api }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    api.on('POST', '/api/workspaces', (route) => route.fulfill({ status: 503 }));
    const workspaces = new WorkspacesPage(page);
    await api.signInAs(grace, '/workspaces');

    await workspaces.newWorkspace.click();
    const dialog = new CreateWorkspaceDialog(page);
    await dialog.name.fill('Hackathon ops');
    await dialog.create.click();

    await expect(dialog.failed).toBeVisible();
    await expect(dialog.name).toHaveValue('Hackathon ops');
  });

  test('a member sees only the workspaces they were added to, with no New workspace', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const ruth = api.addAccount({
      email: 'ruth@example.org',
      name: 'Ruth Alvarez',
      roles: ['Volunteer'],
    });
    api.agile.addWorkspace({
      name: 'Toronto team',
      ownerId: grace.profileId,
      memberIds: [ruth.profileId],
    });
    api.agile.addWorkspace({ name: 'Hackathon ops', ownerId: grace.profileId });
    const workspaces = new WorkspacesPage(page);

    await api.signInAs(ruth, '/workspaces');

    await expect(workspaces.subtitle).toHaveText('Workspaces you’ve been added to');
    await expect(workspaces.items).toHaveCount(1);
    await expect(workspaces.ownerBadge('Toronto team')).toHaveCount(0);
    await expect(workspaces.newWorkspace).toHaveCount(0);
    await axe.check();
  });

  test('a member in no workspace is told how to join one', async ({ page, api, axe }) => {
    const ruth = api.addAccount({
      email: 'ruth@example.org',
      name: 'Ruth Alvarez',
      roles: ['Volunteer'],
    });
    const workspaces = new WorkspacesPage(page);

    await api.signInAs(ruth, '/workspaces');

    await expect(page.getByRole('heading', { name: 'No workspaces yet' })).toBeVisible();
    await expect(workspaces.newWorkspace).toHaveCount(0);
    await axe.check();
  });

  test('Staff see every workspace, read-only', async ({ page, api, axe }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const daniel = api.addAccount({
      email: 'daniel@example.org',
      name: 'Daniel Reyes',
      roles: ['Staff'],
    });
    api.agile.addWorkspace({ name: 'Toronto team', ownerId: grace.profileId });
    api.agile.addWorkspace({ name: 'Hackathon ops', ownerId: grace.profileId });
    const workspaces = new WorkspacesPage(page);

    await api.signInAs(daniel, '/workspaces');

    await expect(workspaces.subtitle).toHaveText('Every workspace, read-only');
    await expect(workspaces.readOnly).toBeVisible();
    await expect(workspaces.items).toHaveCount(2);
    await expect(workspaces.newWorkspace).toHaveCount(0);
    await axe.check();
  });

  test('a failed load offers to try again', async ({ page, api, axe }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    let fail = true;
    api.on('GET', '/api/workspaces', (route) =>
      fail ? route.fulfill({ status: 503 }) : api.fallback(route),
    );
    const workspaces = new WorkspacesPage(page);
    await api.signInAs(grace, '/workspaces');
    await expect(workspaces.loadError).toBeVisible();
    await axe.check();

    fail = false;
    await workspaces.tryAgain.click();

    await expect(workspaces.empty).toBeVisible();
  });
});
