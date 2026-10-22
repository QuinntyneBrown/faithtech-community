import { expect, test } from '../../../e2e/fixtures/app';
import { WorkItemDialog } from '../../../e2e/pages/work-item.dialog';
import { WorkItemPage } from '../../../e2e/pages/work-item.page';
import { Presenter } from '../presenter';

// Journey: work items (docs/detailed-designs/agile/work-items, L2-031, L2-033).
test('work-items', async ({ page, api }) => {
  const show = await Presenter.start(page, 'work-items');
  const item = new WorkItemPage(page);
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

  await show.card(
    'opening',
    'opening',
    ['Work a story from start to finish', 'Recorded against a local fake API · synthetic people'],
    () => api.signInAs(samuel, `/workspaces/${ws.id}/items/${story.id}`),
  );

  await show.step(
    'story',
    async () => {
      await expect(item.heading).toHaveText('Shelter problem briefs for teams');
      await expect(item.description).toContainText('one-page brief');
      await expect(item.fact('Story points')).toContainText('8');
      await expect(item.fact('Epic')).toContainText('Tech for Shelters hackathon');
      await expect(item.fact('Initiative')).toContainText('Launch the hackathon season');
    },
    { poster: true },
  );

  await show.step('tasks', async () => {
    await expect(item.tasksHeading).toContainText('1 of 2 done');
    await item.task('Edit six briefs').check();
    await expect(item.tasksHeading).toContainText('2 of 2 done');
  });

  await show.step('add-task', async () => {
    await item.newTask.fill('Share briefs with teams');
    await item.addTask.click();
    await expect(item.task('Share briefs with teams')).toBeVisible();
    await expect(item.tasksHeading).toContainText('2 of 3 done');
  });

  await show.step('comment', async () => {
    await item.commentBox.fill('Two shelters want to co-present their brief.');
    await item.comment.click();
    await expect(item.commentsHeading).toHaveText('Comments (2)');
  });

  await show.step('edit', async () => {
    await item.edit.click();
    const dialog = new WorkItemDialog(page, 'Edit story');
    await expect(dialog.title).toHaveValue('Shelter problem briefs for teams');
    await dialog.assignee.selectOption({ label: 'Ruth Alvarez' });
    await dialog.points.selectOption({ label: '13' });
    await dialog.submit.click();
    await expect(dialog.dialog).toBeHidden();
    await expect(item.fact('Assignee')).toContainText('Ruth Alvarez');
  });

  await show.step('status', async () => {
    await item.status.selectOption({ label: 'Done' });
    await expect(item.toast).toContainText('Moved to Done');
  });

  await show.card('closing', 'closing', [
    'Initiatives, epics, stories and tasks',
    'Tasks, comments and status in one place',
  ]);
  await show.finish();
});
