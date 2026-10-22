using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Agile;
using FaithTech.Community.Domain.Notifications;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Agile;

public record CreateWorkItemCommand(
    string? Kind, string? Title, string? Description = null, Guid? ParentId = null, Guid? AssigneeId = null, int? StoryPoints = null);

public record UpdateWorkItemCommand(string? Title, string? Description, Guid? AssigneeId = null, int? StoryPoints = null, string? Status = null);

public record SetDoneCommand(bool Done);

public record AddCommentCommand(string? Body);

public class CreateWorkItemValidator : AbstractValidator<CreateWorkItemCommand>
{
    public CreateWorkItemValidator()
    {
        RuleFor(x => x.Kind)
            .Must(kind => Enum.TryParse<WorkItemKind>(kind, ignoreCase: false, out var k) && Enum.IsDefined(k))
            .WithMessage("Choose initiative, epic, story or task.");
        RuleFor(x => x.Title).WorkItemTitle();
        RuleFor(x => x.Description).Must(d => (d?.Length ?? 0) <= WorkItemRules.MaxDescription)
            .WithMessage($"Use {WorkItemRules.MaxDescription} characters or fewer for the description.");
        RuleFor(x => x.StoryPoints).Must(p => p is null or >= 0).WithMessage("Story points can’t be negative.");
    }
}

public class UpdateWorkItemValidator : AbstractValidator<UpdateWorkItemCommand>
{
    public UpdateWorkItemValidator()
    {
        RuleFor(x => x.Title).WorkItemTitle();
        RuleFor(x => x.Description).Must(d => (d?.Length ?? 0) <= WorkItemRules.MaxDescription)
            .WithMessage($"Use {WorkItemRules.MaxDescription} characters or fewer for the description.");
        RuleFor(x => x.StoryPoints).Must(p => p is null or >= 0).WithMessage("Story points can’t be negative.");
        RuleFor(x => x.Status)
            .Must(s => s is null || (Enum.TryParse<WorkItemStatus>(s, ignoreCase: false, out var v) && Enum.IsDefined(v)))
            .WithMessage("Choose To Do, In Progress or Done.");
    }
}

public class AddCommentValidator : AbstractValidator<AddCommentCommand>
{
    public AddCommentValidator()
    {
        RuleFor(x => x.Body).Cascade(CascadeMode.Stop)
            .Must(b => !string.IsNullOrWhiteSpace(b)).WithMessage("Write a comment first.")
            .Must(b => b!.Trim().Length <= WorkItemRules.MaxComment).WithMessage($"Use {WorkItemRules.MaxComment} characters or fewer.");
    }
}

public static class TitleRules
{
    /// <summary>A title is required and at most 200 characters (L2-033 AC1, AC5).</summary>
    public static IRuleBuilderOptions<T, string?> WorkItemTitle<T>(this IRuleBuilderInitial<T, string?> rule) =>
        rule.Cascade(CascadeMode.Stop)
            .Must(t => !string.IsNullOrWhiteSpace(t)).WithMessage("Give it a title.")
            .Must(t => t!.Trim().Length <= WorkItem.MaxTitleLength).WithMessage($"Use {WorkItem.MaxTitleLength} characters or fewer for the title.");
}

public static class WorkItemRules
{
    public const int MaxDescription = 4000;
    public const int MaxComment = 2000;

    /// <summary>Only the owner (or System Admin) plans initiatives and epics (L2-031 AC3).</summary>
    public static bool NeedsManage(WorkItemKind kind) => kind is WorkItemKind.Initiative or WorkItemKind.Epic;

    /// <summary>The message for a parent that breaks the hierarchy (L2-032 AC1, AC3), or null when the link is allowed.</summary>
    public static string? ParentProblem(WorkItemKind kind, WorkItem? parent, Guid workspaceId) => kind switch
    {
        WorkItemKind.Task when parent is null || parent.Kind != WorkItemKind.Story || parent.WorkspaceId != workspaceId => "A task must belong to a story.",
        _ when parent is null => null,
        WorkItemKind.Initiative => "An initiative has no parent.",
        WorkItemKind.Epic when parent.Kind != WorkItemKind.Initiative || parent.WorkspaceId != workspaceId => "An epic sits only under an initiative.",
        WorkItemKind.Story when parent.Kind != WorkItemKind.Epic || parent.WorkspaceId != workspaceId => "A story sits only under an epic.",
        _ => null,
    };

    public const string NotMemberMessage = "Choose someone in this workspace.";
}

/// <summary>Creates, edits, completes and comments on work items, and reads one item (L2-032, L2-033).</summary>
public class WorkItemsHandler(
    IApplicationDbContext db,
    WorkspaceAccessPolicy policy,
    AgileNotifier notifier,
    IBoardNotifier board,
    TimeProvider time)
{
    public async Task<(Result Result, WorkItemDto? Item)> CreateAsync(Guid workspaceId, CreateWorkItemCommand command, CancellationToken cancellationToken = default)
    {
        var kind = Enum.Parse<WorkItemKind>(command.Kind!);
        var (workspace, caller, refusal) = await policy.AuthorizeAsync(workspaceId, WorkItemRules.NeedsManage(kind), cancellationToken);
        if (refusal is not null)
        {
            return (refusal, null);
        }

        var parent = command.ParentId is { } parentId
            ? await db.WorkItems.SingleOrDefaultAsync(i => i.Id == parentId, cancellationToken)
            : null;
        if (WorkItemRules.ParentProblem(kind, parent, workspaceId) is { } problem || (command.ParentId is not null && parent is null))
        {
            return (Result.Invalid("ParentId", WorkItemRules.ParentProblem(kind, parent, workspaceId) ?? "Choose a parent in this workspace."), null);
        }

        if (command.AssigneeId is { } assignee && !workspace.IsMember(assignee))
        {
            return (Result.Invalid("AssigneeId", WorkItemRules.NotMemberMessage), null);
        }

        if (command.StoryPoints is not null && kind != WorkItemKind.Story)
        {
            return (Result.Invalid("StoryPoints", "Only stories have story points."), null);
        }

        var item = new WorkItem(workspaceId, kind, command.Title!.Trim(), command.Description?.Trim() ?? string.Empty, parent);
        item.Assign(command.AssigneeId, workspace);
        if (kind == WorkItemKind.Story)
        {
            item.SetStoryPoints(command.StoryPoints);
        }

        db.WorkItems.Add(item);
        await NotifyAssigneeAsync(caller.ProfileId, null, item, workspace, cancellationToken);
        policy.AuditOverride(caller, "workitem.created", "WorkItem", item.Id, null, new { Kind = kind.ToString(), item.Title, WorkspaceId = workspaceId });
        await db.SaveChangesAsync(cancellationToken);
        await notifier.SendEmailsAsync(cancellationToken);
        return (Result.Ok(), await GetAsync(item.Id, cancellationToken));
    }

    public async Task<Result> UpdateAsync(Guid itemId, UpdateWorkItemCommand command, CancellationToken cancellationToken = default)
    {
        var item = await db.WorkItems.SingleOrDefaultAsync(i => i.Id == itemId, cancellationToken);
        if (item is null)
        {
            return Result.NotFound();
        }

        var (workspace, caller, refusal) = await policy.AuthorizeAsync(item.WorkspaceId, WorkItemRules.NeedsManage(item.Kind), cancellationToken);
        if (refusal is not null)
        {
            return refusal;
        }

        if (command.AssigneeId is { } assignee && !workspace.IsMember(assignee))
        {
            return Result.Invalid("AssigneeId", WorkItemRules.NotMemberMessage);
        }

        if (command.StoryPoints is not null && item.Kind != WorkItemKind.Story)
        {
            return Result.Invalid("StoryPoints", "Only stories have story points.");
        }

        var before = Snapshot(item);
        var previousAssignee = item.AssigneeId;
        var previousStatus = item.Status;
        item.Edit(command.Title!.Trim(), command.Description?.Trim() ?? string.Empty);
        item.Assign(command.AssigneeId, workspace);
        if (item.Kind == WorkItemKind.Story)
        {
            item.SetStoryPoints(command.StoryPoints);
        }

        if (item.Kind != WorkItemKind.Task && command.Status is { } status)
        {
            item.SetStatus(Enum.Parse<WorkItemStatus>(status));
        }

        await NotifyAssigneeAsync(caller.ProfileId, previousAssignee, item, workspace, cancellationToken);
        policy.AuditOverride(caller, "workitem.updated", "WorkItem", item.Id, before, Snapshot(item));
        await db.SaveChangesAsync(cancellationToken);
        await notifier.SendEmailsAsync(cancellationToken);
        if (item.Status != previousStatus)
        {
            await board.CardMovedAsync(item.WorkspaceId, item.Id, item.Status.ToString(), cancellationToken);
        }

        return Result.Ok();
    }

    public async Task<Result> SetDoneAsync(Guid itemId, SetDoneCommand command, CancellationToken cancellationToken = default)
    {
        var item = await db.WorkItems.SingleOrDefaultAsync(i => i.Id == itemId, cancellationToken);
        if (item is null)
        {
            return Result.NotFound();
        }

        var (_, caller, refusal) = await policy.AuthorizeAsync(item.WorkspaceId, manage: false, cancellationToken);
        if (refusal is not null)
        {
            return refusal;
        }

        if (item.Kind != WorkItemKind.Task)
        {
            return Result.Conflict("Only tasks are ticked off; move a story on the board instead.");
        }

        var before = item.IsDone;
        item.SetDone(command.Done);
        policy.AuditOverride(caller, "workitem.updated", "WorkItem", item.Id, new { IsDone = before }, new { item.IsDone });
        await db.SaveChangesAsync(cancellationToken);
        return Result.Ok();
    }

    public async Task<(Result Result, CommentDto? Comment)> AddCommentAsync(Guid itemId, AddCommentCommand command, CancellationToken cancellationToken = default)
    {
        var item = await db.WorkItems.SingleOrDefaultAsync(i => i.Id == itemId, cancellationToken);
        if (item is null)
        {
            return (Result.NotFound(), null);
        }

        var (_, caller, refusal) = await policy.AuthorizeAsync(item.WorkspaceId, manage: false, cancellationToken);
        if (refusal is not null)
        {
            return (refusal, null);
        }

        var comment = item.AddComment(caller.ProfileId, command.Body!.Trim(), time.GetUtcNow());
        policy.AuditOverride(caller, "workitem.commented", "WorkItem", item.Id, null, new { comment.Body });
        await db.SaveChangesAsync(cancellationToken);
        var author = await db.Profiles.Where(p => p.Id == caller.ProfileId).Select(p => p.Name).SingleOrDefaultAsync(cancellationToken);
        return (Result.Ok(), new CommentDto(comment.Id, comment.AuthorId, author ?? "A former member", comment.Body, comment.CreatedAt));
    }

    /// <summary>The item, or null when it does not exist, is archived, or the caller may not see its workspace.</summary>
    public async Task<WorkItemDto?> GetAsync(Guid itemId, CancellationToken cancellationToken = default)
    {
        var item = await db.WorkItems.AsNoTracking().SingleOrDefaultAsync(i => i.Id == itemId, cancellationToken);
        if (item is null)
        {
            return null;
        }

        var (workspace, caller) = await policy.LoadAsync(item.WorkspaceId, cancellationToken);
        if (workspace is null || !caller.CanRead)
        {
            return null;
        }

        var parent = item.ParentId is { } pid ? await db.WorkItems.AsNoTracking().SingleOrDefaultAsync(i => i.Id == pid, cancellationToken) : null;
        var grandparent = parent?.ParentId is { } gid ? await db.WorkItems.AsNoTracking().SingleOrDefaultAsync(i => i.Id == gid, cancellationToken) : null;
        var tasks = item.Kind == WorkItemKind.Story
            ? await db.WorkItems.AsNoTracking().Where(i => i.ParentId == item.Id && i.Kind == WorkItemKind.Task).OrderBy(i => i.Title).ToListAsync(cancellationToken)
            : [];
        var sprint = item.SprintId is { } sid ? await db.Sprints.AsNoTracking().SingleOrDefaultAsync(s => s.Id == sid, cancellationToken) : null;

        var peopleIds = tasks.Select(t => t.AssigneeId).Append(item.AssigneeId).OfType<Guid>()
            .Concat(item.Comments.Select(c => c.AuthorId)).Distinct().ToList();
        var names = await db.Profiles.AsNoTracking().Where(p => peopleIds.Contains(p.Id)).ToDictionaryAsync(p => p.Id, p => p.Name, cancellationToken);
        string? NameOf(Guid? id) => id is { } x ? names.GetValueOrDefault(x) ?? "A former member" : null;

        return new WorkItemDto(
            item.Id,
            workspace.Id,
            workspace.Name,
            item.Kind.ToString(),
            item.Title,
            item.Description,
            item.Status.ToString(),
            item.IsDone,
            item.AssigneeId,
            NameOf(item.AssigneeId),
            item.StoryPoints,
            parent is null ? null : new WorkItemRefDto(parent.Id, parent.Kind.ToString(), parent.Title),
            grandparent is null ? null : new WorkItemRefDto(grandparent.Id, grandparent.Kind.ToString(), grandparent.Title),
            sprint is null ? null : new SprintRefDto(sprint.Id, sprint.Name, sprint.State.ToString()),
            [.. tasks.Select(t => new TaskDto(t.Id, t.Title, t.IsDone, t.AssigneeId, NameOf(t.AssigneeId)))],
            [.. item.Comments.OrderByDescending(c => c.CreatedAt).Select(c => new CommentDto(c.Id, c.AuthorId, NameOf(c.AuthorId)!, c.Body, c.CreatedAt))],
            caller.CanEdit && (!WorkItemRules.NeedsManage(item.Kind) || caller.CanManage),
            caller.CanManage);
    }

    /// <summary>
    /// The backlog tree (L2-032 AC4), optionally only one initiative's or one epic's subtree, or only the
    /// stories with no epic. Null when the caller may not see the workspace.
    /// </summary>
    public async Task<IReadOnlyList<BacklogNodeDto>?> BacklogAsync(
        Guid workspaceId, Guid? initiativeId = null, Guid? epicId = null, bool noEpic = false, CancellationToken cancellationToken = default)
    {
        var (workspace, caller) = await policy.LoadAsync(workspaceId, cancellationToken);
        if (workspace is null || !caller.CanRead)
        {
            return null;
        }

        var items = await db.WorkItems.AsNoTracking().Where(i => i.WorkspaceId == workspaceId).ToListAsync(cancellationToken);
        var assigneeIds = items.Select(i => i.AssigneeId).OfType<Guid>().Distinct().ToList();
        var names = await db.Profiles.AsNoTracking().Where(p => assigneeIds.Contains(p.Id)).ToDictionaryAsync(p => p.Id, p => p.Name, cancellationToken);
        var byParent = items.Where(i => i.ParentId is not null).ToLookup(i => i.ParentId!.Value);
        var ids = items.Select(i => i.Id).ToHashSet();

        BacklogNodeDto Node(WorkItem i) => new(
            i.Id, i.Kind.ToString(), i.Title, i.Status.ToString(), i.IsDone, i.StoryPoints, i.AssigneeId,
            i.AssigneeId is { } a ? names.GetValueOrDefault(a) : null, i.SprintId,
            [.. Ordered(byParent[i.Id]).Select(Node)]);

        // Roots are items without a (visible) parent: an archived parent hides its subtree's root too.
        IEnumerable<WorkItem> roots = items.Where(i => i.ParentId is null || !ids.Contains(i.ParentId.Value));
        if (initiativeId is { } initiative)
        {
            roots = items.Where(i => i.Id == initiative && i.Kind == WorkItemKind.Initiative);
        }
        else if (epicId is { } epic)
        {
            roots = items.Where(i => i.Id == epic && i.Kind == WorkItemKind.Epic);
        }
        else if (noEpic)
        {
            roots = roots.Where(i => i.Kind == WorkItemKind.Story);
        }

        return [.. Ordered(roots.Where(i => i.Kind != WorkItemKind.Task)).Select(Node)];
    }

    private static IEnumerable<WorkItem> Ordered(IEnumerable<WorkItem> items) => items.OrderBy(i => i.Kind).ThenBy(i => i.Title);

    private static object Snapshot(WorkItem item) =>
        new { item.Title, item.Description, Status = item.Status.ToString(), item.AssigneeId, item.StoryPoints };

    /// <summary>The assignee hears about a new assignment in-app and by email (L2-033 AC3); nobody hears about their own.</summary>
    private async Task NotifyAssigneeAsync(Guid actor, Guid? previous, WorkItem item, Workspace workspace, CancellationToken cancellationToken)
    {
        if (item.AssigneeId is not { } assignee || assignee == previous)
        {
            return;
        }

        var actorName = await db.Profiles.Where(p => p.Id == actor).Select(p => p.Name).SingleOrDefaultAsync(cancellationToken) ?? "A workspace member";
        var points = item.StoryPoints is { } p ? $" ({p} {(p == 1 ? "point" : "points")})" : string.Empty;
        notifier.Notify(
            actor,
            assignee,
            NotificationKind.WorkItemAssigned,
            $"{actorName} assigned you {item.Title}",
            $"/workspaces/{workspace.Id}/items/{item.Id}",
            $"{AgileNotifier.FirstName(actorName)} assigned you: {item.Title}",
            $"{actorName} assigned you “{item.Title}”{points} in the {workspace.Name} workspace.\n\nOpen the {item.Kind.ToString().ToLowerInvariant()}:");
    }
}
