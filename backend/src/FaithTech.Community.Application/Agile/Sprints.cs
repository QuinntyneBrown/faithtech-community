using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Agile;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Agile;

/// <summary>A sprint with its stories now; closed sprints add what they completed of what they committed.</summary>
public record SprintDto(
    Guid Id,
    string Name,
    string Goal,
    DateOnly StartDate,
    DateOnly EndDate,
    string State,
    int StoryCount,
    int Points,
    int? CompletedPoints,
    int? CommittedPoints);

/// <summary>A story the next sprint can take: from the backlog, or unfinished in the active sprint.</summary>
public record SprintCandidateDto(Guid Id, string Title, int? StoryPoints, string Status, string? ReturnedFrom);

/// <summary>
/// The sprints of a Scrum workspace (L2-035): the active one, the closed history newest first, and the average
/// completed points of the last three closed sprints, which guides the next one.
/// </summary>
public record SprintsDto(
    SprintDto? Active,
    IReadOnlyList<SprintDto> History,
    int? AverageCompletedPoints,
    IReadOnlyList<SprintCandidateDto> Candidates);

public record StartSprintCommand(string? Name, string? Goal, DateOnly? StartDate, DateOnly? EndDate, IReadOnlyList<Guid>? StoryIds);

public record AddStoriesToSprintCommand(IReadOnlyList<Guid>? StoryIds);

public class StartSprintValidator : AbstractValidator<StartSprintCommand>
{
    public StartSprintValidator()
    {
        RuleFor(x => x.Name).Cascade(CascadeMode.Stop)
            .Must(n => !string.IsNullOrWhiteSpace(n)).WithMessage("Give the sprint a name.")
            .Must(n => n!.Trim().Length <= 100).WithMessage("Use 100 characters or fewer for the name.");
        RuleFor(x => x.Goal).Cascade(CascadeMode.Stop)
            .Must(g => !string.IsNullOrWhiteSpace(g)).WithMessage("Write a goal so the team knows what done looks like.")
            .Must(g => g!.Trim().Length <= 200).WithMessage("Use 200 characters or fewer for the goal.");
        RuleFor(x => x.StartDate).NotNull().WithMessage("Choose when the sprint starts.");
        RuleFor(x => x.EndDate).Cascade(CascadeMode.Stop)
            .NotNull().WithMessage("Choose when the sprint ends.")
            .Must((command, end) => command.StartDate is null || end > command.StartDate)
            .WithMessage("Choose an end date after the start date.");
        RuleFor(x => x.StoryIds).Must(ids => ids is { Count: > 0 }).WithMessage("Choose at least one story.");
    }
}

public class AddStoriesToSprintValidator : AbstractValidator<AddStoriesToSprintCommand>
{
    public AddStoriesToSprintValidator()
    {
        RuleFor(x => x.StoryIds).Must(ids => ids is { Count: > 0 }).WithMessage("Choose at least one story.");
    }
}

/// <summary>Starts, plans and closes sprints in a Scrum workspace (L2-035). Only the owner starts and closes them.</summary>
public class SprintsHandler(IApplicationDbContext db, WorkspaceAccessPolicy policy)
{
    /// <summary>How many closed sprints the "recent average" looks back over.</summary>
    public const int RecentSprints = 3;

    public async Task<SprintsDto?> GetAsync(Guid workspaceId, CancellationToken cancellationToken = default)
    {
        var (workspace, caller) = await policy.LoadAsync(workspaceId, cancellationToken);
        if (workspace is null || !caller.CanRead)
        {
            return null;
        }

        var sprints = await db.Sprints.AsNoTracking().Where(s => s.WorkspaceId == workspaceId).ToListAsync(cancellationToken);
        var stories = await db.WorkItems.AsNoTracking()
            .Where(i => i.WorkspaceId == workspaceId && i.Kind == WorkItemKind.Story)
            .ToListAsync(cancellationToken);
        var active = sprints.SingleOrDefault(s => s.State == SprintState.Active);
        var history = sprints.Where(s => s.State == SprintState.Closed).OrderByDescending(s => s.EndDate).ToList();

        SprintDto Dto(Sprint s)
        {
            var mine = stories.Where(i => i.SprintId == s.Id).ToList();
            return new SprintDto(s.Id, s.Name, s.Goal, s.StartDate, s.EndDate, s.State.ToString(), mine.Count,
                mine.Sum(i => i.StoryPoints ?? 0), s.CompletedPoints, s.CommittedPoints);
        }

        var candidates = stories
            .Where(i => i.Status != WorkItemStatus.Done && (i.SprintId is null || i.SprintId == active?.Id))
            .OrderBy(i => i.Title)
            .Select(i => new SprintCandidateDto(i.Id, i.Title, i.StoryPoints, i.Status.ToString(), i.SprintId is null ? null : active!.Name))
            .ToList();
        return new SprintsDto(
            active is null ? null : Dto(active),
            [.. history.Select(Dto)],
            history.Count == 0 ? null : (int)Math.Round(history.Take(RecentSprints).Average(s => s.CompletedPoints ?? 0), MidpointRounding.AwayFromZero),
            candidates);
    }

    /// <summary>
    /// The owner starts a sprint with its stories; an active sprint closes first, returning its unfinished
    /// stories to the backlog, so no two sprints are ever active (L2-035 AC1, AC3, AC5).
    /// </summary>
    public async Task<(Result Result, Guid? SprintId)> StartAsync(Guid workspaceId, StartSprintCommand command, CancellationToken cancellationToken = default)
    {
        var (workspace, caller, refusal) = await policy.AuthorizeAsync(workspaceId, manage: true, cancellationToken);
        if (refusal is not null)
        {
            return (refusal, null);
        }

        if (workspace.Method != WorkspaceMethod.Scrum)
        {
            return (Result.Conflict("Sprints run only in a Scrum workspace."), null);
        }

        // Archived stories still count toward the sprint they were in when it closes, as a direct close counts them;
        // only live stories can be chosen for the new sprint.
        var stories = await db.WorkItems.IgnoreQueryFilters()
            .Where(i => i.WorkspaceId == workspaceId && i.Kind == WorkItemKind.Story)
            .ToListAsync(cancellationToken);
        var chosen = stories.Where(s => !s.IsArchived && command.StoryIds!.Contains(s.Id)).ToList();
        if (chosen.Count != command.StoryIds!.Distinct().Count())
        {
            return (Result.Invalid("StoryIds", "Choose stories from this workspace."), null);
        }

        var sprints = await db.Sprints.Where(s => s.WorkspaceId == workspaceId).ToListAsync(cancellationToken);
        var sprint = new Sprint(workspaceId, command.Name!.Trim(), command.Goal!.Trim(), command.StartDate!.Value, command.EndDate!.Value);
        db.Sprints.Add(sprint);
        // The active sprint closes first, so it records everything it committed; then the chosen stories,
        // including any it left unfinished, join the new one.
        workspace.StartSprint(sprint, sprints, stories);
        foreach (var story in chosen)
        {
            story.MoveToSprint(sprint);
        }

        policy.AuditOverride(caller, "sprint.started", "Sprint", sprint.Id, null, new { sprint.Name, sprint.Goal, StoryIds = chosen.Select(s => s.Id) });
        await db.SaveChangesAsync(cancellationToken);
        return (Result.Ok(), sprint.Id);
    }

    /// <summary>Any member puts stories into the planned or active sprint (L2-035 AC2).</summary>
    public async Task<Result> AddStoriesAsync(Guid workspaceId, Guid sprintId, AddStoriesToSprintCommand command, CancellationToken cancellationToken = default)
    {
        var (_, caller, refusal) = await policy.AuthorizeAsync(workspaceId, manage: false, cancellationToken);
        if (refusal is not null)
        {
            return refusal;
        }

        var sprint = await db.Sprints.SingleOrDefaultAsync(s => s.Id == sprintId && s.WorkspaceId == workspaceId, cancellationToken);
        if (sprint is null)
        {
            return Result.NotFound();
        }

        if (sprint.State == SprintState.Closed)
        {
            return Result.Conflict("A closed sprint takes no more stories.");
        }

        var stories = await db.WorkItems.Where(i => command.StoryIds!.Contains(i.Id) && i.WorkspaceId == workspaceId && i.Kind == WorkItemKind.Story)
            .ToListAsync(cancellationToken);
        if (stories.Count != command.StoryIds!.Distinct().Count())
        {
            return Result.Invalid("StoryIds", "Choose stories from this workspace.");
        }

        foreach (var story in stories)
        {
            story.MoveToSprint(sprint);
        }

        policy.AuditOverride(caller, "sprint.stories.added", "Sprint", sprint.Id, null, new { StoryIds = stories.Select(s => s.Id) });
        await db.SaveChangesAsync(cancellationToken);
        return Result.Ok();
    }

    /// <summary>The owner closes the sprint: unfinished stories return to the backlog and completed points are recorded (AC3).</summary>
    public async Task<Result> CloseAsync(Guid workspaceId, Guid sprintId, CancellationToken cancellationToken = default)
    {
        var (_, caller, refusal) = await policy.AuthorizeAsync(workspaceId, manage: true, cancellationToken);
        if (refusal is not null)
        {
            return refusal;
        }

        var sprint = await db.Sprints.SingleOrDefaultAsync(s => s.Id == sprintId && s.WorkspaceId == workspaceId, cancellationToken);
        if (sprint is null)
        {
            return Result.NotFound();
        }

        if (sprint.State == SprintState.Closed)
        {
            return Result.Conflict("This sprint is already closed.");
        }

        var stories = await db.WorkItems.IgnoreQueryFilters().Where(i => i.SprintId == sprintId).ToListAsync(cancellationToken);
        sprint.Close(stories);
        policy.AuditOverride(caller, "sprint.closed", "Sprint", sprint.Id, null, new { sprint.CompletedPoints, sprint.CommittedPoints });
        await db.SaveChangesAsync(cancellationToken);
        return Result.Ok();
    }
}
