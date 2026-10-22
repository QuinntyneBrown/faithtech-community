// Traces to: L2-034, L2-035, L2-036
using FaithTech.Community.Domain.Agile;
using static FaithTech.Community.Application.Tests.Domain.Agile.WorkspaceTests;

namespace FaithTech.Community.Application.Tests.Domain.Agile;

public class SprintTests
{
    private static readonly DateOnly Monday = new(2026, 11, 2);

    private readonly Workspace _workspace = NewWorkspace(WorkspaceMethod.Scrum);

    private Sprint NewSprint(string name = "Sprint 1") => new(_workspace.Id, name, "Ship sign-up", Monday, Monday.AddDays(13));

    private WorkItem Story(int? points = null, WorkItemStatus status = WorkItemStatus.ToDo)
    {
        var story = new WorkItem(_workspace.Id, WorkItemKind.Story, "Story", "", null);
        story.SetStoryPoints(points);
        story.SetStatus(status);
        return story;
    }

    [Fact]
    public void A_new_sprint_is_planned()
    {
        var sprint = NewSprint();

        Assert.Equal(
            (_workspace.Id, "Sprint 1", "Ship sign-up", Monday, Monday.AddDays(13), SprintState.Planned, (int?)null),
            (sprint.WorkspaceId, sprint.Name, sprint.Goal, sprint.StartDate, sprint.EndDate, sprint.State, sprint.CompletedPoints));
    }

    [Theory]
    [InlineData("", "Goal")]
    [InlineData("Sprint 1", " ")]
    public void A_sprint_needs_a_name_and_a_goal(string name, string goal)
    {
        Assert.Throws<ArgumentException>(() => new Sprint(_workspace.Id, name, goal, Monday, Monday.AddDays(13)));
    }

    [Fact]
    public void A_sprint_must_end_after_it_starts()
    {
        Assert.Throws<ArgumentException>(() => new Sprint(_workspace.Id, "Sprint 1", "Goal", Monday, Monday));
    }

    [Fact]
    public void Stories_can_move_into_a_planned_or_active_sprint()
    {
        var sprint = NewSprint();
        var story = Story();

        story.MoveToSprint(sprint);

        Assert.Equal(sprint.Id, story.SprintId);
    }

    [Fact]
    public void Only_stories_move_into_a_sprint_of_their_own_workspace()
    {
        var sprint = NewSprint();
        var epic = new WorkItem(_workspace.Id, WorkItemKind.Epic, "Epic", "", null);
        var foreign = new WorkItem(Guid.NewGuid(), WorkItemKind.Story, "Story", "", null);

        Assert.Throws<InvalidOperationException>(() => epic.MoveToSprint(sprint));
        Assert.Throws<InvalidOperationException>(() => foreign.MoveToSprint(sprint));
    }

    [Fact]
    public void Starting_a_sprint_makes_it_active()
    {
        var sprint = NewSprint();

        _workspace.StartSprint(sprint, [sprint], []);

        Assert.Equal(SprintState.Active, sprint.State);
    }

    [Fact]
    public void Starting_the_next_sprint_closes_the_active_one_first()
    {
        var first = NewSprint();
        var unfinished = Story(3);
        _workspace.StartSprint(first, [first], []);
        unfinished.MoveToSprint(first);
        var next = NewSprint("Sprint 2");

        _workspace.StartSprint(next, [first, next], [unfinished]);

        Assert.Equal((SprintState.Closed, SprintState.Active), (first.State, next.State));
        Assert.Null(unfinished.SprintId);
    }

    [Fact]
    public void Sprints_run_only_in_a_scrum_workspace()
    {
        var kanban = NewWorkspace(WorkspaceMethod.Kanban);
        var sprint = new Sprint(kanban.Id, "Sprint 1", "Goal", Monday, Monday.AddDays(13));

        Assert.Throws<InvalidOperationException>(() => kanban.StartSprint(sprint, [sprint], []));
    }

    [Fact]
    public void Closing_returns_unfinished_stories_to_the_backlog_and_records_completed_points()
    {
        var sprint = NewSprint();
        _workspace.StartSprint(sprint, [sprint], []);
        var done = Story(5, WorkItemStatus.Done);
        var alsoDone = Story(3, WorkItemStatus.Done);
        var inProgress = Story(8, WorkItemStatus.InProgress);
        var elsewhere = Story(13, WorkItemStatus.Done);
        foreach (var story in new[] { done, alsoDone, inProgress })
        {
            story.MoveToSprint(sprint);
        }

        sprint.Close([done, alsoDone, inProgress, elsewhere]);

        Assert.Equal((SprintState.Closed, (int?)8, (int?)16), (sprint.State, sprint.CompletedPoints, sprint.CommittedPoints));
        Assert.Equal(((Guid?)sprint.Id, (Guid?)null), (done.SprintId, inProgress.SprintId));
        Assert.Equal(WorkItemStatus.InProgress, inProgress.Status);
    }

    [Fact]
    public void A_closed_sprint_cannot_be_closed_started_or_given_stories()
    {
        var sprint = NewSprint();
        _workspace.StartSprint(sprint, [sprint], []);
        sprint.Close([]);

        Assert.Throws<InvalidOperationException>(() => sprint.Close([]));
        Assert.Throws<InvalidOperationException>(() => _workspace.StartSprint(sprint, [sprint], []));
        Assert.Throws<InvalidOperationException>(() => Story().MoveToSprint(sprint));
    }

    [Fact]
    public void Switching_from_scrum_to_kanban_closes_open_sprints_and_keeps_every_status()
    {
        var active = NewSprint();
        _workspace.StartSprint(active, [active], []);
        var story = Story(2, WorkItemStatus.InProgress);
        story.MoveToSprint(active);

        _workspace.SwitchMethod(WorkspaceMethod.Kanban, [active], [story]);

        Assert.Equal((WorkspaceMethod.Kanban, SprintState.Closed, WorkItemStatus.InProgress), (_workspace.Method, active.State, story.Status));
    }

    [Fact]
    public void Switching_from_kanban_to_scrum_puts_unfinished_stories_in_the_backlog()
    {
        var kanban = NewWorkspace(WorkspaceMethod.Kanban);
        var todo = new WorkItem(kanban.Id, WorkItemKind.Story, "Story", "", null);
        var done = new WorkItem(kanban.Id, WorkItemKind.Story, "Story", "", null);
        done.SetStatus(WorkItemStatus.Done);

        kanban.SwitchMethod(WorkspaceMethod.Scrum, [], [todo, done]);

        Assert.Equal(WorkspaceMethod.Scrum, kanban.Method);
        Assert.Equal(((Guid?)null, WorkItemStatus.ToDo, WorkItemStatus.Done), (todo.SprintId, todo.Status, done.Status));
    }

    [Fact]
    public void Switching_to_the_current_method_is_rejected()
    {
        Assert.Throws<InvalidOperationException>(() => _workspace.SwitchMethod(WorkspaceMethod.Scrum, [], []));
    }
}
