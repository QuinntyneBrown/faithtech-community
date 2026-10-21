namespace FaithTech.Community.Application.Agile;

public record WorkItemRefDto(Guid Id, string Kind, string Title);

public record TaskDto(Guid Id, string Title, bool IsDone, Guid? AssigneeId, string? AssigneeName);

public record CommentDto(Guid Id, Guid AuthorId, string AuthorName, string Body, DateTimeOffset CreatedAt);

public record SprintRefDto(Guid Id, string Name, string State);

/// <summary>
/// One work item on its page (L2-033): fields, parent and grandparent (epic and initiative of a story), the
/// story's tasks and the comments, newest first. <see cref="CanManage"/> covers archiving and, for
/// initiatives and epics, editing.
/// </summary>
public record WorkItemDto(
    Guid Id,
    Guid WorkspaceId,
    string WorkspaceName,
    string Kind,
    string Title,
    string Description,
    string Status,
    bool IsDone,
    Guid? AssigneeId,
    string? AssigneeName,
    int? StoryPoints,
    WorkItemRefDto? Parent,
    WorkItemRefDto? Grandparent,
    SprintRefDto? Sprint,
    IReadOnlyList<TaskDto> Tasks,
    IReadOnlyList<CommentDto> Comments,
    bool CanEdit,
    bool CanManage);

/// <summary>A node of the backlog tree (L2-032 AC4): initiatives hold epics, epics stories, stories tasks.</summary>
public record BacklogNodeDto(
    Guid Id,
    string Kind,
    string Title,
    string Status,
    bool IsDone,
    int? StoryPoints,
    Guid? AssigneeId,
    string? AssigneeName,
    Guid? SprintId,
    IReadOnlyList<BacklogNodeDto> Children);
