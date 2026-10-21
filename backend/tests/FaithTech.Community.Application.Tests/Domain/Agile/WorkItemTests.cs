// Traces to: L2-031, L2-032, L2-033, L2-034, L2-037
using FaithTech.Community.Domain.Agile;
using FaithTech.Community.Domain.Profiles;
using static FaithTech.Community.Application.Tests.Domain.Agile.WorkspaceTests;

namespace FaithTech.Community.Application.Tests.Domain.Agile;

public class WorkItemTests
{
    private readonly Workspace _workspace = NewWorkspace();

    private WorkItem Item(WorkItemKind kind, WorkItem? parent = null) => new(_workspace.Id, kind, $"{kind} title", "", parent);

    [Theory]
    [InlineData(WorkItemKind.Initiative, WorkItemKind.Epic, true)]
    [InlineData(WorkItemKind.Epic, WorkItemKind.Story, true)]
    [InlineData(WorkItemKind.Story, WorkItemKind.Task, true)]
    [InlineData(WorkItemKind.Initiative, WorkItemKind.Story, false)]
    [InlineData(WorkItemKind.Epic, WorkItemKind.Task, false)]
    [InlineData(WorkItemKind.Story, WorkItemKind.Epic, false)]
    [InlineData(WorkItemKind.Task, WorkItemKind.Task, false)]
    [InlineData(WorkItemKind.Initiative, WorkItemKind.Initiative, false)]
    public void Only_epic_under_initiative_story_under_epic_and_task_under_story_are_allowed(WorkItemKind parent, WorkItemKind child, bool allowed)
    {
        Assert.Equal(allowed, WorkItemHierarchy.CanParent(parent, child));
    }

    [Theory]
    [InlineData(WorkItemKind.Initiative)]
    [InlineData(WorkItemKind.Epic)]
    [InlineData(WorkItemKind.Story)]
    public void Initiatives_epics_and_stories_may_have_no_parent(WorkItemKind kind)
    {
        var item = Item(kind);

        Assert.Equal((kind, (Guid?)null, WorkItemStatus.ToDo, false), (item.Kind, item.ParentId, item.Status, item.IsArchived));
    }

    [Fact]
    public void A_task_must_belong_to_a_story()
    {
        Assert.Throws<InvalidOperationException>(() => Item(WorkItemKind.Task));
        Assert.Throws<InvalidOperationException>(() => Item(WorkItemKind.Task, Item(WorkItemKind.Epic)));

        var story = Item(WorkItemKind.Story);
        Assert.Equal(story.Id, Item(WorkItemKind.Task, story).ParentId);
    }

    [Fact]
    public void A_parent_of_the_wrong_kind_is_rejected()
    {
        var story = Item(WorkItemKind.Story);

        Assert.Throws<InvalidOperationException>(() => story.SetParent(Item(WorkItemKind.Initiative)));
        Assert.Null(story.ParentId);

        var epic = Item(WorkItemKind.Epic);
        story.SetParent(epic);
        Assert.Equal(epic.Id, story.ParentId);
    }

    [Fact]
    public void A_parent_from_another_workspace_is_rejected()
    {
        var otherEpic = new WorkItem(Guid.NewGuid(), WorkItemKind.Epic, "Other", "", null);

        Assert.Throws<InvalidOperationException>(() => Item(WorkItemKind.Story).SetParent(otherEpic));
    }

    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    public void A_work_item_needs_a_title(string title)
    {
        Assert.Throws<ArgumentException>(() => new WorkItem(_workspace.Id, WorkItemKind.Story, title, "", null));
    }

    [Fact]
    public void A_title_is_at_most_200_characters()
    {
        Assert.Throws<ArgumentException>(() => new WorkItem(_workspace.Id, WorkItemKind.Story, new string('x', 201), "", null));
        Assert.Equal(200, new WorkItem(_workspace.Id, WorkItemKind.Story, new string('x', 200), "", null).Title.Length);
    }

    [Fact]
    public void Editing_changes_the_title_and_description()
    {
        var story = Item(WorkItemKind.Story);

        story.Edit("Sign-up flow", "As a visitor...");

        Assert.Equal(("Sign-up flow", "As a visitor..."), (story.Title, story.Description));
    }

    [Fact]
    public void An_item_can_be_assigned_to_a_workspace_member_and_unassigned()
    {
        var member = ProfileWith(Role.Volunteer);
        _workspace.AddMember(member, Now);
        var story = Item(WorkItemKind.Story);

        story.Assign(member.Id, _workspace);
        Assert.Equal(member.Id, story.AssigneeId);

        story.Assign(null, _workspace);
        Assert.Null(story.AssigneeId);
    }

    [Fact]
    public void An_item_cannot_be_assigned_to_someone_outside_the_workspace()
    {
        var story = Item(WorkItemKind.Story);

        Assert.Throws<InvalidOperationException>(() => story.Assign(Guid.NewGuid(), _workspace));
    }

    [Fact]
    public void Only_stories_have_story_points()
    {
        var story = Item(WorkItemKind.Story);
        story.SetStoryPoints(5);
        Assert.Equal(5, story.StoryPoints);

        Assert.Throws<InvalidOperationException>(() => Item(WorkItemKind.Epic).SetStoryPoints(3));
        Assert.Throws<ArgumentOutOfRangeException>(() => story.SetStoryPoints(-1));
    }

    [Fact]
    public void Moving_a_card_changes_its_status()
    {
        var story = Item(WorkItemKind.Story);

        story.SetStatus(WorkItemStatus.InProgress);

        Assert.Equal(WorkItemStatus.InProgress, story.Status);
    }

    [Fact]
    public void A_task_has_a_done_flag_instead_of_a_status()
    {
        var task = Item(WorkItemKind.Task, Item(WorkItemKind.Story));

        task.SetDone(true);
        Assert.True(task.IsDone);

        Assert.Throws<InvalidOperationException>(() => task.SetStatus(WorkItemStatus.Done));
        Assert.Throws<InvalidOperationException>(() => Item(WorkItemKind.Story).SetDone(true));
    }

    [Fact]
    public void Comments_are_recorded_with_author_and_time()
    {
        var story = Item(WorkItemKind.Story);
        var author = Guid.NewGuid();

        var comment = story.AddComment(author, "Looks good.", Now);

        Assert.Equal((story.Id, author, "Looks good.", Now), (comment.WorkItemId, comment.AuthorId, comment.Body, comment.CreatedAt));
        Assert.Equal([comment], story.Comments);
        Assert.Throws<ArgumentException>(() => story.AddComment(author, " ", Now));
    }

    [Fact]
    public void Archiving_a_story_also_archives_its_tasks_and_restoring_brings_them_back()
    {
        var story = Item(WorkItemKind.Story);
        var task = Item(WorkItemKind.Task, story);
        var otherTask = Item(WorkItemKind.Task, Item(WorkItemKind.Story));
        var owner = Guid.NewGuid();

        story.Archive([task, otherTask], owner, Now);
        Assert.Equal((true, true, false), (story.IsArchived, task.IsArchived, otherTask.IsArchived));
        Assert.Equal((owner, (DateTimeOffset?)Now), (story.ArchivedById, story.ArchivedAt));
        Assert.Throws<InvalidOperationException>(() => story.Archive([], owner, Now));

        story.Restore([task, otherTask]);
        Assert.Equal((false, false), (story.IsArchived, task.IsArchived));
        Assert.Equal(((Guid?)null, (DateTimeOffset?)null), (story.ArchivedById, story.ArchivedAt));
        Assert.Throws<InvalidOperationException>(() => story.Restore([]));
    }

    [Fact]
    public void Archiving_an_epic_hides_its_stories_and_their_tasks_and_restore_leaves_items_archived_earlier()
    {
        var epic = Item(WorkItemKind.Epic);
        var story = Item(WorkItemKind.Story, epic);
        var task = Item(WorkItemKind.Task, story);
        var earlier = Item(WorkItemKind.Story, epic);
        earlier.Archive([], Guid.NewGuid(), Now.AddDays(-3));

        epic.Archive([story, task], Guid.NewGuid(), Now);
        Assert.Equal((true, true, true), (epic.IsArchived, story.IsArchived, task.IsArchived));

        epic.Restore([story, task, earlier]);
        Assert.Equal((false, false, false, true), (epic.IsArchived, story.IsArchived, task.IsArchived, earlier.IsArchived));
    }

    [Fact]
    public void Removing_a_member_unassigns_their_items()
    {
        var member = ProfileWith(Role.Volunteer);
        var other = ProfileWith(Role.Volunteer);
        _workspace.AddMember(member, Now);
        _workspace.AddMember(other, Now);
        var theirs = Item(WorkItemKind.Story);
        var others = Item(WorkItemKind.Story);
        theirs.Assign(member.Id, _workspace);
        others.Assign(other.Id, _workspace);

        _workspace.RemoveMember(member.Id, [theirs, others]);

        Assert.False(_workspace.IsMember(member.Id));
        Assert.Equal(((Guid?)null, (Guid?)other.Id), (theirs.AssigneeId, others.AssigneeId));
    }

    [Fact]
    public void Removing_someone_who_is_not_a_member_is_rejected()
    {
        Assert.Throws<InvalidOperationException>(() => _workspace.RemoveMember(Guid.NewGuid(), []));
        Assert.Throws<InvalidOperationException>(() => _workspace.RemoveMember(_workspace.OwnerId, []));
    }
}
