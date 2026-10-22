using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Agile;
using FaithTech.Community.Domain.Notifications;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Agile;

public record StartPokerCommand(IReadOnlyList<Guid>? StoryIds, IReadOnlyList<Guid>? InvitedIds);

public class StartPokerValidator : AbstractValidator<StartPokerCommand>
{
    public StartPokerValidator()
    {
        RuleFor(x => x.StoryIds).Must(ids => ids is { Count: > 0 }).WithMessage("Choose at least one story to estimate.");
    }
}

/// <summary>A card from the deck ("1" to "21" or "?"), or null to withdraw the vote.</summary>
public record CastVoteCommand(string? Value);

public class CastVoteValidator : AbstractValidator<CastVoteCommand>
{
    public CastVoteValidator()
    {
        RuleFor(x => x.Value).Must(v => v is null || PokerDeck.TryParse(v, out _)).WithMessage("Choose a card from the deck.");
    }
}

public record SetPointsCommand(int? Points);

public class SetPointsValidator : AbstractValidator<SetPointsCommand>
{
    public SetPointsValidator()
    {
        RuleFor(x => x.Points).Must(p => p is { } v && PokerDeck.Points.Contains(v)).WithMessage("Choose the final points from the deck.");
    }
}

public static class PokerDeck
{
    public static readonly int[] Points = [1, 2, 3, 5, 8, 13, 21];

    public static bool TryParse(string value, out DeckValue card)
    {
        card = DeckValue.Unknown;
        if (value == "?")
        {
            return true;
        }

        if (int.TryParse(value, out var points) && Points.Contains(points))
        {
            card = (DeckValue)points;
            return true;
        }

        return false;
    }

    public static string Text(DeckValue card) => card == DeckValue.Unknown ? "?" : ((int)card).ToString();
}

public record PokerStoryDto(Guid Id, string Title, string Description, int? StoryPoints);

/// <summary>
/// One participant. <see cref="Vote"/> is withheld until the reveal, except the caller's own (L2-038 AC2, AC8).
/// </summary>
public record PokerParticipantDto(Guid ProfileId, string Name, bool IsFacilitator, bool HasVoted, string? Vote);

/// <summary>The open session as the caller sees it (L2-038).</summary>
public record PokerSessionDto(
    Guid Id,
    Guid WorkspaceId,
    Guid FacilitatorId,
    string FacilitatorName,
    bool IsFacilitator,
    bool CanVote,
    int StoryNumber,
    int StoryCount,
    PokerStoryDto Story,
    string? NextStoryTitle,
    int Round,
    bool IsRevealed,
    string? MyVote,
    IReadOnlyList<PokerParticipantDto> Participants,
    string? LastStoryTitle,
    int? LastPoints);

/// <summary>
/// Planning Poker (L2-038, ADR 0012). Any member starts a session and facilitates it; invitees vote; only the
/// facilitator reveals, re-votes, sets points and ends it. Staff watch. A System Admin may do anything a member
/// may, as an audited override (L2-031 AC7, ADR 0011). Every change is saved, then broadcast as a bare "changed"
/// so clients re-read.
/// </summary>
public class PlanningPokerHandler(
    IApplicationDbContext db,
    WorkspaceAccessPolicy policy,
    AgileNotifier notifier,
    IPokerBroadcaster broadcaster)
{
    public const string NotMemberMessage = "Only members of this workspace can be invited.";

    public async Task<(Result Result, PokerSessionDto? Session)> StartAsync(Guid workspaceId, StartPokerCommand command, CancellationToken cancellationToken = default)
    {
        var (workspace, caller, refusal) = await policy.AuthorizeAsync(workspaceId, manage: false, cancellationToken);
        if (refusal is not null)
        {
            return (refusal, null);
        }

        var invited = (command.InvitedIds ?? []).Distinct().Where(id => id != caller.ProfileId).ToList();
        if (invited.Any(id => !workspace.IsMember(id)))
        {
            return (Result.Invalid("InvitedIds", NotMemberMessage), null);
        }

        var ids = command.StoryIds!.Distinct().ToList();
        var found = await db.WorkItems.Where(i => ids.Contains(i.Id)).ToListAsync(cancellationToken);
        if (found.Count != ids.Count || found.Any(s => s.Kind != WorkItemKind.Story || s.WorkspaceId != workspaceId))
        {
            return (Result.Invalid("StoryIds", "Choose stories from this workspace."), null);
        }

        if (await OpenSessionAsync(workspaceId, cancellationToken) is not null)
        {
            return (Result.Conflict("A Planning Poker session is already running in this workspace."), null);
        }

        var stories = ids.Select(id => found.Single(s => s.Id == id)).ToList();
        var session = new PokerSession(workspace, stories, caller.ProfileId, invited);
        db.PokerSessions.Add(session);
        policy.AuditOverride(caller, "poker.started", "PokerSession", session.Id, null, new { StoryIds = ids, InvitedIds = invited });

        var name = await db.Profiles.Where(p => p.Id == caller.ProfileId).Select(p => p.Name).SingleAsync(cancellationToken);
        var first = AgileNotifier.FirstName(name);
        foreach (var id in invited)
        {
            notifier.Notify(
                caller.ProfileId,
                id,
                NotificationKind.PlanningPokerInvite,
                $"{first} invited you to Planning Poker in {workspace.Name}",
                $"/workspaces/{workspace.Id}/poker",
                $"Join Planning Poker in {workspace.Name}",
                $"{name} invited you to estimate {Count(stories.Count)} in {workspace.Name}, starting with “{stories[0].Title}”. Votes stay hidden until {first} reveals them.\n\nJoin the session:");
        }

        await notifier.QueueEmailsAsync(cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        return (Result.Ok(), await DtoAsync(session, caller, cancellationToken));
    }

    /// <summary>The workspace's open session; a null session with an Ok result means none is running.</summary>
    public async Task<(Result Result, PokerSessionDto? Session)> CurrentAsync(Guid workspaceId, CancellationToken cancellationToken = default)
    {
        var (workspace, caller) = await policy.LoadAsync(workspaceId, cancellationToken);
        if (workspace is null || !caller.CanRead)
        {
            return (Result.NotFound(), null);
        }

        var session = await OpenSessionAsync(workspaceId, cancellationToken);
        return (Result.Ok(), session is null ? null : await DtoAsync(session, caller, cancellationToken));
    }

    public async Task<PokerSessionDto?> GetAsync(Guid sessionId, CancellationToken cancellationToken = default)
    {
        var (session, caller, refusal) = await LoadAsync(sessionId, write: false, cancellationToken);
        return refusal is null && !session.IsComplete ? await DtoAsync(session, caller, cancellationToken) : null;
    }

    public Task<Result> VoteAsync(Guid sessionId, CastVoteCommand command, CancellationToken cancellationToken = default) =>
        ChangeAsync(sessionId, "poker.voted", facilitatorOnly: false, (session, caller) =>
        {
            if (command.Value is null)
            {
                session.WithdrawVote(caller.ProfileId);
            }
            else
            {
                PokerDeck.TryParse(command.Value, out var card);
                session.CastVote(caller.ProfileId, card);
            }

            return Task.FromResult<Result?>(null);
        }, cancellationToken);

    public Task<Result> RevealAsync(Guid sessionId, CancellationToken cancellationToken = default) =>
        ChangeAsync(sessionId, "poker.revealed", facilitatorOnly: true, (session, caller) =>
        {
            session.Reveal(caller.ProfileId);
            return Task.FromResult<Result?>(null);
        }, cancellationToken);

    public Task<Result> RevoteAsync(Guid sessionId, CancellationToken cancellationToken = default) =>
        ChangeAsync(sessionId, "poker.revoted", facilitatorOnly: true, (session, caller) =>
        {
            session.Revote(caller.ProfileId);
            return Task.FromResult<Result?>(null);
        }, cancellationToken);

    public Task<Result> EndAsync(Guid sessionId, CancellationToken cancellationToken = default) =>
        ChangeAsync(sessionId, "poker.ended", facilitatorOnly: true, (session, caller) =>
        {
            session.End(caller.ProfileId);
            return Task.FromResult<Result?>(null);
        }, cancellationToken);

    public Task<Result> SetPointsAsync(Guid sessionId, SetPointsCommand command, CancellationToken cancellationToken = default) =>
        ChangeAsync(sessionId, "poker.points.set", facilitatorOnly: true, async (session, caller) =>
        {
            var story = await db.WorkItems.SingleOrDefaultAsync(i => i.Id == session.CurrentStoryId, cancellationToken);
            if (story is null)
            {
                return Result.Conflict("The story being estimated was archived.");
            }

            session.SetFinalPoints(caller.ProfileId, command.Points!.Value, story);
            return null;
        }, cancellationToken);

    private async Task<Result> ChangeAsync(
        Guid sessionId, string action, bool facilitatorOnly, Func<PokerSession, WorkspaceCaller, Task<Result?>> change, CancellationToken cancellationToken)
    {
        var (session, caller, refusal) = await LoadAsync(sessionId, write: true, cancellationToken);
        if (refusal is not null)
        {
            return refusal;
        }

        if (session.IsComplete)
        {
            return Result.Conflict("This session has ended.");
        }

        // Who may act is settled before what state the round is in, so an uninvited member is told 403 both
        // before and after the reveal, and only a participant's late vote gets the 409 (L2-038 AC6, AC7, AC10).
        if (facilitatorOnly ? caller.ProfileId != session.FacilitatorId : !session.IsParticipant(caller.ProfileId))
        {
            return Result.Forbidden();
        }

        if (session.IsRevealed && !facilitatorOnly)
        {
            return Result.Conflict("Votes are already revealed. Wait for a re-vote.");
        }

        var before = new { session.Round, session.IsRevealed, StoryId = session.CurrentStoryId };
        if (await change(session, caller) is { } problem)
        {
            return problem;
        }

        policy.AuditOverride(caller, action, "PokerSession", session.Id, before, new { session.Round, session.IsRevealed, StoryId = session.CurrentStoryId });
        await db.SaveChangesAsync(cancellationToken);
        await broadcaster.PokerChangedAsync(session.Id, cancellationToken);
        return Result.Ok();
    }

    /// <summary>404 for an outsider; a write by a reader who may not edit (Staff) is 403.</summary>
    private async Task<(PokerSession Session, WorkspaceCaller Caller, Result? Refusal)> LoadAsync(Guid sessionId, bool write, CancellationToken cancellationToken)
    {
        var session = await db.PokerSessions.SingleOrDefaultAsync(s => s.Id == sessionId, cancellationToken);
        if (session is null)
        {
            return (null!, null!, Result.NotFound());
        }

        var (workspace, caller) = await policy.LoadAsync(session.WorkspaceId, cancellationToken);
        if (workspace is null || !caller.CanRead)
        {
            return (null!, caller, Result.NotFound());
        }

        return (session, caller, write && !caller.CanEdit ? Result.Forbidden() : null);
    }

    private async Task<PokerSession?> OpenSessionAsync(Guid workspaceId, CancellationToken cancellationToken) =>
        (await db.PokerSessions.Where(s => s.WorkspaceId == workspaceId && !s.IsClosed).ToListAsync(cancellationToken))
            .FirstOrDefault(s => !s.IsComplete);

    private async Task<PokerSessionDto> DtoAsync(PokerSession session, WorkspaceCaller caller, CancellationToken cancellationToken)
    {
        var storyIds = new[] { session.CurrentStoryId, session.LastStoryId, NextId(session) }.OfType<Guid>().ToList();
        var stories = await db.WorkItems.IgnoreQueryFilters().AsNoTracking().Where(i => storyIds.Contains(i.Id)).ToDictionaryAsync(i => i.Id, cancellationToken);
        var people = session.InvitedIds.Prepend(session.FacilitatorId).ToList();
        var names = await db.Profiles.AsNoTracking().Where(p => people.Contains(p.Id)).ToDictionaryAsync(p => p.Id, p => p.Name, cancellationToken);
        string NameOf(Guid id) => names.GetValueOrDefault(id) ?? "A former member";

        var story = stories[session.CurrentStoryId!.Value];
        var participants = session.InvitedIds
            .OrderBy(NameOf)
            .Prepend(session.FacilitatorId)
            .Select(id =>
            {
                var vote = session.CurrentVoteOf(id);
                var shown = vote is { } v && (session.IsRevealed || id == caller.ProfileId) ? PokerDeck.Text(v) : null;
                return new PokerParticipantDto(id, NameOf(id), id == session.FacilitatorId, vote is not null, shown);
            })
            .ToList();
        var mine = session.CurrentVoteOf(caller.ProfileId);
        return new PokerSessionDto(
            session.Id,
            session.WorkspaceId,
            session.FacilitatorId,
            NameOf(session.FacilitatorId),
            caller.ProfileId == session.FacilitatorId,
            session.IsParticipant(caller.ProfileId) && caller.CanEdit,
            session.CurrentStoryIndex + 1,
            session.StoryIds.Count,
            new PokerStoryDto(story.Id, story.Title, story.Description, story.StoryPoints),
            NextId(session) is { } next ? stories.GetValueOrDefault(next)?.Title : null,
            session.Round,
            session.IsRevealed,
            mine is { } m ? PokerDeck.Text(m) : null,
            participants,
            session.LastStoryId is { } last ? stories.GetValueOrDefault(last)?.Title : null,
            session.LastPoints);
    }

    private static Guid? NextId(PokerSession session) =>
        session.CurrentStoryIndex + 1 < session.StoryIds.Count ? session.StoryIds[session.CurrentStoryIndex + 1] : null;

    private static string Count(int stories) => stories == 1 ? "1 story" : $"{stories} stories";
}
