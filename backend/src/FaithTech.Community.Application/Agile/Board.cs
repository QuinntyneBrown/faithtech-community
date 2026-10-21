using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Agile;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Agile;

public record BoardCardDto(Guid Id, string Title, Guid? AssigneeId, string? AssigneeName, int? StoryPoints, int TasksDone, int TasksTotal);

public record BoardColumnDto(string Status, IReadOnlyList<BoardCardDto> Cards);

/// <summary>The active sprint of a Scrum board: completed points count its Done stories so far.</summary>
public record BoardSprintDto(Guid Id, string Name, string Goal, DateOnly StartDate, DateOnly EndDate, int CompletedPoints, int TotalPoints);

/// <summary>The board (L2-034): stories in the fixed columns To Do, In Progress and Done, no WIP limits.</summary>
public record BoardDto(string Method, BoardSprintDto? Sprint, IReadOnlyList<BoardColumnDto> Columns);

public record MoveCardCommand(string? Status);

public class MoveCardValidator : AbstractValidator<MoveCardCommand>
{
    public MoveCardValidator()
    {
        RuleFor(x => x.Status)
            .Must(s => Enum.TryParse<WorkItemStatus>(s, ignoreCase: false, out var v) && Enum.IsDefined(v))
            .WithMessage("Choose To Do, In Progress or Done.");
    }
}

/// <summary>Reads the board and moves cards across it, telling open viewers (L2-034).</summary>
public class BoardHandler(IApplicationDbContext db, WorkspaceAccessPolicy policy, IBoardNotifier board)
{
    /// <summary>
    /// The board, or null when the caller may not see the workspace. A Scrum board shows only the active
    /// sprint's stories (AC3); a Kanban board can be narrowed to one initiative or epic, or to stories with no epic.
    /// </summary>
    public async Task<BoardDto?> GetAsync(
        Guid workspaceId, Guid? initiativeId = null, Guid? epicId = null, bool noEpic = false, CancellationToken cancellationToken = default)
    {
        var (workspace, caller) = await policy.LoadAsync(workspaceId, cancellationToken);
        if (workspace is null || !caller.CanRead)
        {
            return null;
        }

        var items = await db.WorkItems.AsNoTracking().Where(i => i.WorkspaceId == workspaceId).ToListAsync(cancellationToken);
        var sprint = workspace.Method == WorkspaceMethod.Scrum
            ? await db.Sprints.AsNoTracking().SingleOrDefaultAsync(s => s.WorkspaceId == workspaceId && s.State == SprintState.Active, cancellationToken)
            : null;

        var stories = items.Where(i => i.Kind == WorkItemKind.Story);
        if (workspace.Method == WorkspaceMethod.Scrum)
        {
            stories = sprint is null ? [] : stories.Where(s => s.SprintId == sprint.Id);
        }
        else if (epicId is { } epic)
        {
            stories = stories.Where(s => s.ParentId == epic);
        }
        else if (initiativeId is { } initiative)
        {
            var epics = items.Where(i => i.Kind == WorkItemKind.Epic && i.ParentId == initiative).Select(i => i.Id).ToHashSet();
            stories = stories.Where(s => s.ParentId is { } p && epics.Contains(p));
        }
        else if (noEpic)
        {
            stories = stories.Where(s => s.ParentId is null);
        }

        var cards = stories.OrderBy(s => s.Title).ToList();
        var tasks = items.Where(i => i.Kind == WorkItemKind.Task).ToLookup(t => t.ParentId);
        var assigneeIds = cards.Select(c => c.AssigneeId).OfType<Guid>().Distinct().ToList();
        var names = await db.Profiles.AsNoTracking().Where(p => assigneeIds.Contains(p.Id)).ToDictionaryAsync(p => p.Id, p => p.Name, cancellationToken);

        var columns = Enum.GetValues<WorkItemStatus>()
            .Select(status => new BoardColumnDto(status.ToString(), [.. cards.Where(c => c.Status == status).Select(c => new BoardCardDto(
                c.Id,
                c.Title,
                c.AssigneeId,
                c.AssigneeId is { } a ? names.GetValueOrDefault(a) : null,
                c.StoryPoints,
                tasks[c.Id].Count(t => t.IsDone),
                tasks[c.Id].Count()))]))
            .ToList();
        var sprintDto = sprint is null ? null : new BoardSprintDto(
            sprint.Id, sprint.Name, sprint.Goal, sprint.StartDate, sprint.EndDate,
            cards.Where(c => c.Status == WorkItemStatus.Done).Sum(c => c.StoryPoints ?? 0),
            cards.Sum(c => c.StoryPoints ?? 0));
        return new BoardDto(workspace.Method.ToString(), sprintDto, columns);
    }

    /// <summary>A member moves a story by drag or keyboard (L2-034 AC2); tasks have a done flag instead.</summary>
    public async Task<Result> MoveAsync(Guid itemId, MoveCardCommand command, CancellationToken cancellationToken = default)
    {
        var item = await db.WorkItems.SingleOrDefaultAsync(i => i.Id == itemId, cancellationToken);
        if (item is null)
        {
            return Result.NotFound();
        }

        var (_, caller, refusal) = await policy.AuthorizeAsync(item.WorkspaceId, WorkItemRules.NeedsManage(item.Kind), cancellationToken);
        if (refusal is not null)
        {
            return refusal;
        }

        if (item.Kind == WorkItemKind.Task)
        {
            return Result.Conflict("A task is ticked off on its story, not moved on the board.");
        }

        var before = item.Status;
        item.SetStatus(Enum.Parse<WorkItemStatus>(command.Status!));
        policy.AuditOverride(caller, "workitem.moved", "WorkItem", item.Id, new { Status = before.ToString() }, new { Status = item.Status.ToString() });
        await db.SaveChangesAsync(cancellationToken);
        await board.CardMovedAsync(item.WorkspaceId, item.Id, item.Status.ToString(), cancellationToken);
        return Result.Ok();
    }
}
