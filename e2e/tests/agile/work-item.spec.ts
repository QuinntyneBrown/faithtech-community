// Traces to: L2-031 AC3, AC5, L2-033 (docs/detailed-designs/agile/work-items)
import { expect, test } from '../../fixtures/app';
import { MockApi } from '../../fixtures/mock-api';
import { WorkItemDialog } from '../../pages/work-item.dialog';
import { WorkItemPage } from '../../pages/work-item.page';

function briefs(api: MockApi) {
  const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
  const samuel = api.addAccount({
    email: 'samuel@example.org',
    name: 'Samuel Mensah',
    roles: ['CreateLead'],
  });
  const ruth = api.addAccount({
    email: 'ruth@example.org',
    name: 'Ruth Alvarez',
    roles: ['Volunteer'],
  });
  const ws = api.agile.addWorkspace({
    name: 'Toronto team',
    ownerId: grace.profileId,
    memberIds: [samuel.profileId, ruth.profileId],
  });
  const initiative = api.agile.addItem({
    workspaceId: ws.id,
    kind: 'Initiative',
    title: 'Launch the hackathon season',
  });
  const epic = api.agile.addItem({
    workspaceId: ws.id,
    kind: 'Epic',
    title: 'Tech for Shelters hackathon',
    parentId: initiative.id,
  });
  const story = api.agile.addItem({
    workspaceId: ws.id,
    kind: 'Story',
    title: 'Shelter problem briefs for teams',
    description: 'As a hackathon team, I want a one-page brief for each shelter problem.',
    parentId: epic.id,
    status: 'InProgress',
    storyPoints: 8,
    assigneeId: grace.profileId,
  });
  api.agile.addItem({
    workspaceId: ws.id,
    kind: 'Task',
    title: 'Interview Harbour Light staff',
    parentId: story.id,
    isDone: true,
    assigneeId: grace.profileId,
  });
  api.agile.addItem({
    workspaceId: ws.id,
    kind: 'Task',
    title: 'Edit six briefs',
    parentId: story.id,
    assigneeId: samuel.profileId,
  });
  api.agile.addComment(
    story.id,
    grace.profileId,
    'Harbour Light interview done.',
    '2026-10-17T10:00:00Z',
  );
  return { grace, samuel, ruth, ws, epic, story };
}

test.describe('Work item', () => {
  test('a member works a story: ticks tasks, adds one, comments and moves it on', async ({
    page,
    api,
    axe,
  }) => {
    const { samuel, ws, story } = briefs(api);
    const item = new WorkItemPage(page);
    await api.signInAs(samuel, `/workspaces/${ws.id}/items/${story.id}`);

    await expect(item.heading).toHaveText('Shelter problem briefs for teams');
    await expect(item.description).toContainText('one-page brief for each shelter problem');
    await expect(item.tasksHeading).toContainText('1 of 2 done');
    await expect(item.fact('Story points')).toContainText('8');
    await expect(item.fact('Assignee')).toContainText('Grace Okonkwo');
    await expect(item.fact('Epic')).toContainText('Tech for Shelters hackathon');
    await expect(item.fact('Initiative')).toContainText('Launch the hackathon season');
    await expect(item.comments).toHaveCount(1);
    await axe.check();

    await item.task('Edit six briefs').check();
    await expect(item.tasksHeading).toContainText('2 of 2 done');
    expect(api.agile.items.find((i) => i.title === 'Edit six briefs')!.isDone).toBe(true);

    await item.newTask.fill('Share briefs with teams');
    await item.addTask.click();
    await expect(item.task('Share briefs with teams')).toBeVisible();
    await expect(item.tasksHeading).toContainText('2 of 3 done');

    await item.commentBox.fill('Two shelters want to co-present their brief.');
    await item.comment.click();
    await expect(item.comments.first()).toContainText(
      'Two shelters want to co-present their brief.',
    );
    await expect(item.comments.first()).toContainText('Samuel Mensah');
    await expect(item.commentsHeading).toHaveText('Comments (2)');

    await item.status.selectOption({ label: 'Done' });
    await expect(item.toast).toContainText('Moved to Done');
    expect(api.agile.items.find((i) => i.id === story.id)!.status).toBe('Done');
  });

  test('a member edits a story’s fields in a dialog', async ({ page, api, axe }) => {
    const { samuel, ws, story } = briefs(api);
    const item = new WorkItemPage(page);
    await api.signInAs(samuel, `/workspaces/${ws.id}/items/${story.id}`);

    await item.edit.click();
    const dialog = new WorkItemDialog(page, 'Edit story');
    await expect(dialog.title).toHaveValue('Shelter problem briefs for teams');
    await axe.check();
    await dialog.title.fill('');
    await dialog.submit.click();
    await expect(dialog.error('Give it a title.')).toBeVisible();

    await dialog.title.fill('Shelter problem briefs');
    await dialog.assignee.selectOption({ label: 'Ruth Alvarez' });
    await dialog.points.selectOption({ label: '13' });
    await dialog.submit.click();

    await expect(dialog.dialog).toBeHidden();
    await expect(item.toast).toContainText('Story saved');
    await expect(item.heading).toHaveText('Shelter problem briefs');
    await expect(item.fact('Assignee')).toContainText('Ruth Alvarez');
    await expect(item.fact('Story points')).toContainText('13');
  });

  test('a member cannot edit an epic, only the owner can', async ({ page, api }) => {
    const { samuel, ws, epic } = briefs(api);
    const item = new WorkItemPage(page);

    await api.signInAs(samuel, `/workspaces/${ws.id}/items/${epic.id}`);

    await expect(item.heading).toHaveText('Tech for Shelters hackathon');
    await expect(item.edit).toHaveCount(0);
    await expect(item.status).toHaveCount(0);
  });

  test('a story with no tasks invites the first one', async ({ page, api, axe }) => {
    const { samuel, ws, story } = briefs(api);
    const lonely = api.agile.addItem({
      workspaceId: ws.id,
      kind: 'Story',
      title: 'Volunteer check-in kiosk',
      parentId: story.parentId,
    });
    const item = new WorkItemPage(page);
    await api.signInAs(samuel, `/workspaces/${ws.id}/items/${lonely.id}`);
    await expect(item.noTasks).toBeVisible();
    await axe.check();

    await item.addTask.click();
    const dialog = new WorkItemDialog(page);
    await expect(dialog.kind('Task')).toBeChecked();
    await dialog.title.fill('Buy two tablets');
    await dialog.submit.click();

    await expect(item.task('Buy two tablets')).toBeVisible();
  });

  test('Staff read a story without any way to change it', async ({ page, api, axe }) => {
    const { ws, story } = briefs(api);
    const daniel = api.addAccount({
      email: 'daniel@example.org',
      name: 'Daniel Reyes',
      roles: ['Staff'],
    });
    const item = new WorkItemPage(page);

    await api.signInAs(daniel, `/workspaces/${ws.id}/items/${story.id}`);

    await expect(item.readOnly).toBeVisible();
    await expect(item.task('Edit six briefs')).toBeDisabled();
    await expect(item.edit).toHaveCount(0);
    await expect(item.commentBox).toHaveCount(0);
    await expect(item.newTask).toHaveCount(0);
    await expect(item.fact('Status')).toContainText('In Progress');
    await axe.check();
  });

  test('someone outside the workspace is told they are not a member', async ({ page, api }) => {
    const { ws, story } = briefs(api);
    const leah = api.addAccount({
      email: 'leah@example.org',
      name: 'Leah Thompson',
      roles: ['Volunteer'],
    });
    const item = new WorkItemPage(page);

    await api.signInAs(leah, `/workspaces/${ws.id}/items/${story.id}`);

    await expect(item.notMember).toBeVisible();
  });
});
