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

        var invited = invitedIds.Distinct().ToList();
        if (!workspace.IsMember(facilitatorId) || invited.Any(id => !workspace.IsMember(id)))
        {
            throw new InvalidOperationException("Only workspace members can take part in a session.");
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

    public bool IsComplete => CurrentStoryIndex >= StoryIds.Count;

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
        CurrentStoryIndex++;
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
