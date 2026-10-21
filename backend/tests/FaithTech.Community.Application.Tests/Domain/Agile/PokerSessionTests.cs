// Traces to: L2-038
using FaithTech.Community.Domain.Agile;
using FaithTech.Community.Domain.Profiles;
using static FaithTech.Community.Application.Tests.Domain.Agile.WorkspaceTests;

namespace FaithTech.Community.Application.Tests.Domain.Agile;

public class PokerSessionTests
{
    private readonly Workspace _workspace = NewWorkspace();
    private readonly Guid _facilitator;
    private readonly Guid _voter;
    private readonly WorkItem _first;
    private readonly WorkItem _second;

    public PokerSessionTests()
    {
        var facilitator = ProfileWith(Role.Volunteer);
        var voter = ProfileWith(Role.Volunteer);
        _workspace.AddMember(facilitator, Now);
        _workspace.AddMember(voter, Now);
        _facilitator = facilitator.Id;
        _voter = voter.Id;
        _first = new WorkItem(_workspace.Id, WorkItemKind.Story, "Sign-up", "", null);
        _second = new WorkItem(_workspace.Id, WorkItemKind.Story, "Sign-in", "", null);
    }

    private PokerSession NewSession() => new(_workspace, [_first, _second], _facilitator, [_voter]);

    [Fact]
    public void The_member_who_starts_a_session_facilitates_and_stories_are_estimated_one_at_a_time()
    {
        var session = NewSession();

        Assert.Equal(
            (_facilitator, (Guid?)_first.Id, 1, false, false),
            (session.FacilitatorId, session.CurrentStoryId, session.Round, session.IsRevealed, session.IsComplete));
        Assert.Equal([_first.Id, _second.Id], session.StoryIds);
        Assert.Equal([_voter], session.InvitedIds);
    }

    [Fact]
    public void A_session_needs_at_least_one_story_of_the_workspace()
    {
        var epic = new WorkItem(_workspace.Id, WorkItemKind.Epic, "Epic", "", null);
        var foreign = new WorkItem(Guid.NewGuid(), WorkItemKind.Story, "Story", "", null);

        Assert.Throws<InvalidOperationException>(() => new PokerSession(_workspace, [], _facilitator, [_voter]));
        Assert.Throws<InvalidOperationException>(() => new PokerSession(_workspace, [epic], _facilitator, [_voter]));
        Assert.Throws<InvalidOperationException>(() => new PokerSession(_workspace, [foreign], _facilitator, [_voter]));
    }

    [Fact]
    public void Only_workspace_members_can_facilitate_or_be_invited()
    {
        Assert.Throws<InvalidOperationException>(() => new PokerSession(_workspace, [_first], Guid.NewGuid(), [_voter]));
        Assert.Throws<InvalidOperationException>(() => new PokerSession(_workspace, [_first], _facilitator, [Guid.NewGuid()]));
    }

    [Fact]
    public void Votes_show_who_has_voted_and_keep_each_participants_current_vote()
    {
        var session = NewSession();

        session.CastVote(_voter, DeckValue.Five);
        session.CastVote(_voter, DeckValue.Eight);
        session.CastVote(_facilitator, DeckValue.Unknown);

        Assert.Equal(new HashSet<Guid> { _voter, _facilitator }, session.VoterIds.ToHashSet());
        Assert.Equal(DeckValue.Eight, session.CurrentVoteOf(_voter));
        Assert.Equal(2, session.Votes.Count);
    }

    [Fact]
    public void Someone_who_is_not_a_participant_cannot_vote()
    {
        Assert.Throws<InvalidOperationException>(() => NewSession().CastVote(Guid.NewGuid(), DeckValue.Three));
    }

    [Fact]
    public void Only_the_facilitator_can_reveal()
    {
        var session = NewSession();

        Assert.Throws<InvalidOperationException>(() => session.Reveal(_voter));

        session.Reveal(_facilitator);
        Assert.True(session.IsRevealed);
    }

    [Fact]
    public void Votes_cannot_change_once_revealed()
    {
        var session = NewSession();
        session.Reveal(_facilitator);

        Assert.Throws<InvalidOperationException>(() => session.CastVote(_voter, DeckValue.One));
    }

    [Fact]
    public void A_revote_clears_the_previous_votes_and_starts_a_new_round()
    {
        var session = NewSession();
        session.CastVote(_voter, DeckValue.Five);
        session.Reveal(_facilitator);

        Assert.Throws<InvalidOperationException>(() => session.Revote(_voter));
        session.Revote(_facilitator);

        Assert.Equal((2, false, 0, (DeckValue?)null), (session.Round, session.IsRevealed, session.Votes.Count, session.CurrentVoteOf(_voter)));
    }

    [Fact]
    public void Setting_the_final_points_updates_the_story_and_moves_to_the_next_story()
    {
        var session = NewSession();
        session.CastVote(_voter, DeckValue.Five);
        session.Reveal(_facilitator);

        session.SetFinalPoints(_facilitator, 5, _first);

        Assert.Equal(5, _first.StoryPoints);
        Assert.Equal(((Guid?)_second.Id, 1, false, 0), (session.CurrentStoryId, session.Round, session.IsRevealed, session.Votes.Count));
    }

    [Fact]
    public void The_session_completes_after_the_last_story()
    {
        var session = new PokerSession(_workspace, [_first], _facilitator, [_voter]);

        session.SetFinalPoints(_facilitator, 3, _first);

        Assert.Equal((true, (Guid?)null), (session.IsComplete, session.CurrentStoryId));
        Assert.Throws<InvalidOperationException>(() => session.CastVote(_voter, DeckValue.Two));
    }

    [Fact]
    public void Only_the_facilitator_sets_points_and_only_for_the_current_story()
    {
        var session = NewSession();

        Assert.Throws<InvalidOperationException>(() => session.SetFinalPoints(_voter, 5, _first));
        Assert.Throws<InvalidOperationException>(() => session.SetFinalPoints(_facilitator, 5, _second));
        Assert.Null(_first.StoryPoints);
    }

    [Theory]
    [InlineData(DeckValue.One, 1)]
    [InlineData(DeckValue.Two, 2)]
    [InlineData(DeckValue.Three, 3)]
    [InlineData(DeckValue.Five, 5)]
    [InlineData(DeckValue.Eight, 8)]
    [InlineData(DeckValue.Thirteen, 13)]
    [InlineData(DeckValue.TwentyOne, 21)]
    public void Each_deck_card_is_worth_its_points(DeckValue card, int points)
    {
        Assert.Equal(points, card.Points());
    }

    [Fact]
    public void The_question_mark_card_has_no_points()
    {
        Assert.Null(DeckValue.Unknown.Points());
    }
}
