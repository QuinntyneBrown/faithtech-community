// Traces to: L2-031 AC3, L2-032, L2-033 AC5 (docs/detailed-designs/agile/work-items)
import { expect, test } from '../../fixtures/app';
import { MockApi } from '../../fixtures/mock-api';
import { BacklogPage } from '../../pages/backlog.page';
import { WorkItemDialog } from '../../pages/work-item.dialog';

function torontoBacklog(api: MockApi) {
  const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
  const marcus = api.addAccount({
    email: 'marcus@example.org',
    name: 'Marcus Lee',
    roles: ['EventLead'],
  });
  const ruth = api.addAccount({
    email: 'ruth@example.org',
    name: 'Ruth Alvarez',
    roles: ['Volunteer'],
  });
  const ws = api.agile.addWorkspace({
    name: 'Toronto team',
    ownerId: grace.profileId,
    memberIds: [marcus.profileId, ruth.profileId],
  });
  const initiative = api.agile.addItem({
    workspaceId: ws.id,
    kind: 'Initiative',
    title: 'Launch the hackathon season',
  });
  const shelters = api.agile.addItem({
    workspaceId: ws.id,
    kind: 'Epic',
    title: 'Tech for Shelters hackathon',
    parentId: initiative.id,
  });
  const sponsorships = api.agile.addItem({
    workspaceId: ws.id,
    kind: 'Epic',
    title: 'Partner sponsorships',
    parentId: initiative.id,
  });
  const registration = api.agile.addItem({
    workspaceId: ws.id,
    kind: 'Story',
    title: 'Hackathon registration page',
    parentId: shelters.id,
    status: 'Done',
    storyPoints: 5,
  });
  api.agile.addItem({
    workspaceId: ws.id,
    kind: 'Task',
    title: 'Write registration copy',
    parentId: registration.id,
    isDone: true,
    assigneeId: marcus.profileId,
  });
  api.agile.addItem({
    workspaceId: ws.id,
    kind: 'Story',
    title: 'Lantern Foundation grant proposal',
    parentId: sponsorships.id,
  });
  api.agile.addItem({
    workspaceId: ws.id,
    kind: 'Story',
    title: 'Update the city team photo',
    storyPoints: 1,
  });
  return { grace, marcus, ruth, ws, shelters, registration };
}

test.describe('Backlog', () => {
  test('the backlog is a tree of initiatives, epics, stories and tasks that can be filtered', async ({
    page,
    api,
    axe,
  }) => {
    const { grace, ws } = torontoBacklog(api);
    const backlog = new BacklogPage(page);
    await api.signInAs(grace, `/workspaces/${ws.id}/backlog`);

    await expect(backlog.frame.heading).toHaveText('Toronto team');
    await expect(backlog.frame.section('Backlog')).toHaveAttribute('aria-current', 'page');
    await expect(backlog.row('Launch the hackathon season')).toContainText('Initiative');
    await expect(backlog.row('Launch the hackathon season')).toContainText('2 epics');
    await expect(backlog.row('Tech for Shelters hackathon')).toContainText('1 story');
    await expect(backlog.row('Hackathon registration page')).toContainText('Done · 5 pts');
    await expect(backlog.row('Write registration copy')).toContainText('Done · Marcus');
    await expect(backlog.row('Lantern Foundation grant proposal')).toContainText(
      'To Do · not estimated',
    );
    await expect(backlog.row('Update the city team photo')).toContainText('No epic · To Do · 1 pt');
    await axe.check();

    await backlog.filter.selectOption({ label: 'Epic: Partner sponsorships' });

    await expect(backlog.link('Lantern Foundation grant proposal')).toBeVisible();
    await expect(backlog.link('Hackathon registration page')).toHaveCount(0);
    await expect(backlog.link('Update the city team photo')).toHaveCount(0);

    await backlog.filter.selectOption({ label: 'No epic' });

    await expect(backlog.link('Update the city team photo')).toBeVisible();
    await expect(backlog.link('Launch the hackathon season')).toHaveCount(0);
  });

  test('the owner creates an initiative, and a task needs a story', async ({ page, api, axe }) => {
    const { grace, ws } = torontoBacklog(api);
    const backlog = new BacklogPage(page);
    await api.signInAs(grace, `/workspaces/${ws.id}/backlog`);

    await backlog.newItem.click();
    const dialog = new WorkItemDialog(page);
    await expect(dialog.kind('Initiative')).toBeVisible();
    await axe.check();
    await dialog.kind('Task').check();
    await dialog.title.fill('Edit six briefs');
    await dialog.submit.click();
    await expect(dialog.error('A task must belong to a story.')).toBeVisible();

    await dialog.kind('Initiative').check();
    await dialog.title.fill('Spring city retreat');
    await dialog.submit.click();

    await expect(dialog.dialog).toBeHidden();
    await expect(backlog.toast).toContainText('Spring city retreat created');
    await expect(backlog.row('Spring city retreat')).toContainText('Initiative');
  });

  test('a member creates a story under an epic, and an empty title is caught', async ({
    page,
    api,
    axe,
  }) => {
    const { ruth, ws, shelters } = torontoBacklog(api);
    const backlog = new BacklogPage(page);
    await api.signInAs(ruth, `/workspaces/${ws.id}/backlog`);
    await expect(backlog.frame.section('Settings')).toHaveCount(0);

    await backlog.newItem.click();
    const dialog = new WorkItemDialog(page);
    await expect(dialog.kind('Initiative')).toHaveCount(0);
    await expect(dialog.kind('Epic')).toHaveCount(0);
    await expect(dialog.ownerOnlyNote).toBeVisible();
    await dialog.submit.click();
    await expect(dialog.error('Give it a title.')).toBeVisible();
    await expect(dialog.title).toBeFocused();
    await axe.check();

    await dialog.title.fill('Volunteer check-in kiosk');
    await dialog.parent.selectOption({ label: 'Tech for Shelters hackathon' });
    await dialog.assignee.selectOption({ label: 'Ruth Alvarez' });
    await dialog.points.selectOption({ label: '5' });
    await dialog.description.fill('As a volunteer, I want to check people in on a tablet.');
    await dialog.submit.click();

    await expect(dialog.dialog).toBeHidden();
    await expect(backlog.row('Volunteer check-in kiosk')).toContainText('To Do · 5 pts');
    expect(api.callsTo('POST', `/api/workspaces/${ws.id}/items`)[0].body).toEqual({
      kind: 'Story',
      title: 'Volunteer check-in kiosk',
      description: 'As a volunteer, I want to check people in on a tablet.',
      parentId: shelters.id,
      assigneeId: ruth.profileId,
      storyPoints: 5,
    });
  });

  test('an empty backlog invites the first item', async ({ page, api, axe }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const ws = api.agile.addWorkspace({ name: 'Toronto team', ownerId: grace.profileId });
    const backlog = new BacklogPage(page);

    await api.signInAs(grace, `/workspaces/${ws.id}/backlog`);

    await expect(backlog.empty).toBeVisible();
    await axe.check();
  });

  test('Staff read the backlog with nothing to change', async ({ page, api, axe }) => {
    const { ws } = torontoBacklog(api);
    const daniel = api.addAccount({
      email: 'daniel@example.org',
      name: 'Daniel Reyes',
      roles: ['Staff'],
    });
    const backlog = new BacklogPage(page);

    await api.signInAs(daniel, `/workspaces/${ws.id}/backlog`);

    await expect(backlog.frame.readOnly).toBeVisible();
    await expect(backlog.link('Launch the hackathon season')).toBeVisible();
    await expect(backlog.newItem).toHaveCount(0);
    await axe.check();
  });

  test('someone outside the workspace sees nothing of it', async ({ page, api }) => {
    const { ws } = torontoBacklog(api);
    const leah = api.addAccount({
      email: 'leah@example.org',
      name: 'Leah Thompson',
      roles: ['Volunteer'],
    });
    const backlog = new BacklogPage(page);

    await api.signInAs(leah, `/workspaces/${ws.id}/backlog`);

    await expect(backlog.frame.notMember).toBeVisible();
    await expect(backlog.tree).toHaveCount(0);
  });

  test('a failed load offers to try again', async ({ page, api }) => {
    const { grace, ws } = torontoBacklog(api);
    let fail = true;
    api.on('GET', `/api/workspaces/${ws.id}/backlog`, (route) =>
      fail ? route.fulfill({ status: 503 }) : api.fallback(route),
    );
    const backlog = new BacklogPage(page);
    await api.signInAs(grace, `/workspaces/${ws.id}/backlog`);
    await expect(backlog.loadError).toBeVisible();

    fail = false;
    await page.getByRole('button', { name: 'Try again' }).click();

    await expect(backlog.link('Launch the hackathon season')).toBeVisible();
  });
});
