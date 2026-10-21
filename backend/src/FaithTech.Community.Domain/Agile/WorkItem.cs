namespace FaithTech.Community.Domain.Agile;

public class WorkItem
{
    public const int MaxTitleLength = 200;

    private readonly List<Comment> _comments = [];

    private WorkItem() { }

    public WorkItem(Guid workspaceId, WorkItemKind kind, string title, string description, WorkItem? parent)
    {
        Id = Guid.NewGuid();
        WorkspaceId = workspaceId;
        Kind = kind;
        Edit(title, description);
        if (parent is not null)
        {
            SetParent(parent);
        }
        else if (kind == WorkItemKind.Task)
        {
            throw new InvalidOperationException("A task must belong to a story.");
        }
    }

    public Guid Id { get; private set; }

    public Guid WorkspaceId { get; private set; }

    public WorkItemKind Kind { get; private set; }

    public string Title { get; private set; } = string.Empty;

    public string Description { get; private set; } = string.Empty;

    public WorkItemStatus Status { get; private set; }

    public Guid? AssigneeId { get; private set; }

    public Guid? ParentId { get; private set; }

    public Guid? SprintId { get; private set; }

    public int? StoryPoints { get; private set; }

    public bool IsDone { get; private set; }

    public bool IsArchived { get; private set; }

    public Guid? ArchivedById { get; private set; }

    public DateTimeOffset? ArchivedAt { get; private set; }

    public IReadOnlyCollection<Comment> Comments => _comments;

    public void Edit(string title, string description)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(title);
        if (title.Length > MaxTitleLength)
        {
            throw new ArgumentException($"A title is at most {MaxTitleLength} characters.", nameof(title));
        }

        Title = title;
        Description = description;
    }

    public void SetParent(WorkItem parent)
    {
        if (!WorkItemHierarchy.CanParent(parent.Kind, Kind))
        {
            throw new InvalidOperationException($"A {Kind} cannot sit under a {parent.Kind}.");
        }

        if (parent.WorkspaceId != WorkspaceId)
        {
            throw new InvalidOperationException("A parent must belong to the same workspace.");
        }

        ParentId = parent.Id;
    }

    public void Assign(Guid? profileId, Workspace workspace)
    {
        if (profileId is { } id && !workspace.IsMember(id))
        {
            throw new InvalidOperationException("An assignee must be a member of the workspace.");
        }

        AssigneeId = profileId;
    }

    public void SetStoryPoints(int? points)
    {
        if (Kind != WorkItemKind.Story)
        {
            throw new InvalidOperationException("Only stories have story points.");
        }

        if (points is not null)
        {
            ArgumentOutOfRangeException.ThrowIfNegative(points.Value, nameof(points));
        }

        StoryPoints = points;
    }

    public void SetStatus(WorkItemStatus status)
    {
        if (Kind == WorkItemKind.Task)
        {
            throw new InvalidOperationException("A task has a done flag instead of a status.");
        }

        Status = status;
    }

    public void SetDone(bool done)
    {
        if (Kind != WorkItemKind.Task)
        {
            throw new InvalidOperationException("Only tasks have a done flag.");
        }

        IsDone = done;
    }

    public Comment AddComment(Guid authorId, string body, DateTimeOffset now)
    {
        var comment = new Comment(Id, authorId, body, now);
        _comments.Add(comment);
        return comment;
    }

    /// <summary>
    /// Archives the item and every item under it among <paramref name="items"/>, such as a story's tasks (L2-037 AC1).
    /// Items outside its subtree are left alone.
    /// </summary>
    public void Archive(IEnumerable<WorkItem> items, Guid archivedById, DateTimeOffset now)
    {
        if (IsArchived)
        {
            throw new InvalidOperationException("The work item is already archived.");
        }

        foreach (var item in Subtree(items).Where(i => !i.IsArchived).Append(this))
        {
            item.IsArchived = true;
            item.ArchivedById = archivedById;
            item.ArchivedAt = now;
        }
    }

    /// <summary>Restores the item and the items under it that were archived with it; ones archived earlier stay archived.</summary>
    public void Restore(IEnumerable<WorkItem> items)
    {
        if (!IsArchived)
        {
            throw new InvalidOperationException("The work item is not archived.");
        }

        foreach (var item in Subtree(items).Where(i => i.IsArchived && i.ArchivedAt == ArchivedAt).Append(this))
        {
            item.IsArchived = false;
            item.ArchivedById = null;
            item.ArchivedAt = null;
        }
    }

    public void MoveToSprint(Sprint sprint)
    {
        if (Kind != WorkItemKind.Story || sprint.WorkspaceId != WorkspaceId)
        {
            throw new InvalidOperationException("Only a story of the same workspace can join a sprint.");
        }

        if (sprint.State == SprintState.Closed)
        {
            throw new InvalidOperationException("A closed sprint takes no more stories.");
        }

        SprintId = sprint.Id;
    }

    internal void Unassign() => AssigneeId = null;

    internal void ReturnToBacklog() => SprintId = null;

    private List<WorkItem> Subtree(IEnumerable<WorkItem> items)
    {
        var list = items.Where(i => i != this).ToList();
        var byId = list.ToDictionary(i => i.Id);
        bool Under(WorkItem item)
        {
            for (var parentId = item.ParentId; parentId is { } id; parentId = byId.GetValueOrDefault(id)?.ParentId)
            {
                if (id == Id)
                {
                    return true;
                }
            }

            return false;
        }

        return [.. list.Where(Under)];
    }
}
