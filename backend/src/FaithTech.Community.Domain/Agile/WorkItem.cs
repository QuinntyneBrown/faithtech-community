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

    public void Archive(IEnumerable<WorkItem> children)
    {
        if (IsArchived)
        {
            throw new InvalidOperationException("The work item is already archived.");
        }

        SetArchived(children, true);
    }

    public void Restore(IEnumerable<WorkItem> children)
    {
        if (!IsArchived)
        {
            throw new InvalidOperationException("The work item is not archived.");
        }

        SetArchived(children, false);
    }

    internal void Unassign() => AssigneeId = null;

    private void SetArchived(IEnumerable<WorkItem> children, bool archived)
    {
        IsArchived = archived;
        foreach (var task in children.Where(c => c.ParentId == Id && c.Kind == WorkItemKind.Task))
        {
            task.IsArchived = archived;
        }
    }
}
