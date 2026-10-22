namespace FaithTech.Community.Domain.Agile;

public class PokerSession
{
    private readonly List<PokerVote> _votes = [];

    private PokerSession() { }

    public PokerSession(Workspace workspace, IReadOnlyList<WorkItem> stories, Guid facilitatorId, IEnumerable<Guid> invitedIds)
    {
        if (stories.Count == 0 || stories.Any(s => s.Kind != WorkItemKind.Story || s.WorkspaceId != workspace.Id))
        {
            throw new InvalidOperationException("A session estimates one or more stories of the workspace.");
        }

        // Who may facilitate is the Application's permission decision (a member, or a System Admin override);
        // the session itself only insists that everyone invited belongs to the workspace.
        var invited = invitedIds.Distinct().Where(id => id != facilitatorId).ToList();
        if (invited.Any(id => !workspace.IsMember(id)))
        {
            throw new InvalidOperationException("Only workspace members can be invited to a session.");
        }

        Id = Guid.NewGuid();
        WorkspaceId = workspace.Id;
        StoryIds = stories.Select(s => s.Id).ToList();
        FacilitatorId = facilitatorId;
        InvitedIds = invited;
        Round = 1;
    }

    public Guid Id { get; private set; }

    public Guid WorkspaceId { get; private set; }

    public List<Guid> StoryIds { get; private set; } = [];

    public int CurrentStoryIndex { get; private set; }

    public Guid? CurrentStoryId => IsComplete ? null : StoryIds[CurrentStoryIndex];

    public Guid FacilitatorId { get; private set; }

    public List<Guid> InvitedIds { get; private set; } = [];

    public int Round { get; private set; }

    public bool IsRevealed { get; private set; }

    /// <summary>Set once the last story has its points or the facilitator ends the session; a workspace has one open session.</summary>
    public bool IsClosed { get; private set; }

    public bool IsComplete => IsClosed || CurrentStoryIndex >= StoryIds.Count;

    /// <summary>The story whose points were set last and those points, shown to everyone until the next estimate.</summary>
    public Guid? LastStoryId { get; private set; }

    public int? LastPoints { get; private set; }

    public IReadOnlyCollection<PokerVote> Votes => _votes;

    public IEnumerable<Guid> VoterIds => _votes.Select(v => v.ProfileId);

    public bool IsParticipant(Guid profileId) => profileId == FacilitatorId || InvitedIds.Contains(profileId);

    public DeckValue? CurrentVoteOf(Guid profileId) => _votes.FirstOrDefault(v => v.ProfileId == profileId)?.Value;

    public void CastVote(Guid profileId, DeckValue value)
    {
        EnsureOpen();
        if (!IsParticipant(profileId))
        {
            throw new InvalidOperationException("Only invited participants can vote.");
        }

        if (IsRevealed)
        {
            throw new InvalidOperationException("Votes are already revealed.");
        }

        var existing = _votes.FirstOrDefault(v => v.ProfileId == profileId);
        if (existing is null)
        {
            _votes.Add(new PokerVote(Id, profileId, Round, value));
        }
        else
        {
            existing.Change(value);
        }
    }

    /// <summary>Withdraws the participant's vote in the current round; refused once votes are revealed.</summary>
    public void WithdrawVote(Guid profileId)
    {
        EnsureOpen();
        if (IsRevealed)
        {
            throw new InvalidOperationException("Votes are already revealed.");
        }

        _votes.RemoveAll(v => v.ProfileId == profileId);
    }

    public void End(Guid by)
    {
        EnsureFacilitator(by);
        IsClosed = true;
    }

    public void Reveal(Guid by)
    {
        EnsureFacilitator(by);
        IsRevealed = true;
    }

    public void Revote(Guid by)
    {
        EnsureFacilitator(by);
        StartRound(Round + 1);
    }

    public void SetFinalPoints(Guid by, int points, WorkItem story)
    {
        EnsureFacilitator(by);
        if (story.Id != CurrentStoryId)
        {
            throw new InvalidOperationException("Points can be set only for the story being estimated.");
        }

        story.SetStoryPoints(points);
        LastStoryId = story.Id;
        LastPoints = points;
        CurrentStoryIndex++;
        IsClosed = CurrentStoryIndex >= StoryIds.Count;
        StartRound(1);
    }

    private void StartRound(int round)
    {
        _votes.Clear();
        Round = round;
        IsRevealed = false;
    }

    private void EnsureFacilitator(Guid by)
    {
        EnsureOpen();
        if (by != FacilitatorId)
        {
            throw new InvalidOperationException("Only the facilitator can do that.");
        }
    }

    private void EnsureOpen()
    {
        if (IsComplete)
        {
            throw new InvalidOperationException("The session is complete.");
        }
    }
}
