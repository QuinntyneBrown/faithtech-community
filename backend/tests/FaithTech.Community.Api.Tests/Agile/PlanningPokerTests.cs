// Traces to: L2-038, L2-027, L2-028
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Domain.Agile;
using FaithTech.Community.Domain.Notifications;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Agile;

public class PlanningPokerTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    public record Participant(Guid ProfileId, string Name, bool IsFacilitator, bool HasVoted, string? Vote);

    public record Story(Guid Id, string Title);

    public record Session(
        Guid Id,
        Guid FacilitatorId,
        string FacilitatorName,
        bool IsFacilitator,
        bool CanVote,
        int StoryNumber,
        int StoryCount,
        Story Story,
        bool IsRevealed,
        string? MyVote,
        IReadOnlyList<Participant> Participants,
        string? LastStoryTitle,
        int? LastPoints);

    private async Task<(AgileClients.Cast Cast, Guid First, Guid Second, Guid SessionId)> StartAsync()
    {
        var cast = await factory.AddCastAsync();
        var first = await factory.AddStoryAsync(cast.WorkspaceId, "Shelter problem briefs");
        var second = await factory.AddStoryAsync(cast.WorkspaceId, "Volunteer check-in kiosk");
        var response = await factory.MemberClient(cast).PostAsJsonAsync(
            $"/api/workspaces/{cast.WorkspaceId}/poker-sessions",
            new { StoryIds = new[] { first, second }, InvitedIds = new[] { cast.Owner.ProfileId } });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var session = await response.Content.ReadFromJsonAsync<Session>();
        return (cast, first, second, session!.Id);
    }

    private static Task<Session?> CurrentAsync(HttpClient client, Guid workspaceId) =>
        client.GetFromJsonAsync<Session?>($"/api/workspaces/{workspaceId}/poker-sessions/current");

    [Fact]
    public async Task Given_a_member_when_they_start_a_session_then_they_facilitate_the_first_story_and_invitees_are_notified_in_app_and_by_email()
    {
        var (cast, _, _, _) = await StartAsync();

        var session = await CurrentAsync(factory.MemberClient(cast), cast.WorkspaceId);
        Assert.Equal(
            (cast.Member.ProfileId, true, 1, 2, "Shelter problem briefs", false),
            (session!.FacilitatorId, session.IsFacilitator, session.StoryNumber, session.StoryCount, session.Story.Title, session.IsRevealed));
        Assert.Equal(["Ruth Alvarez", "Grace Okonkwo"], session.Participants.Select(p => p.Name));

        var notification = await factory.WithDbAsync(db => db.Notifications
            .SingleAsync(n => n.RecipientId == cast.Owner.ProfileId && n.Kind == NotificationKind.PlanningPokerInvite));
        Assert.Equal(("Ruth invited you to Planning Poker in Toronto team", $"/workspaces/{cast.WorkspaceId}/poker"), (notification.Title, notification.LinkPath));
        Assert.Single(factory.Emails.SentTo(await factory.EmailOfAsync(cast.Owner)));
    }

    [Fact]
    public async Task Given_no_stories_or_an_invitee_outside_the_workspace_when_starting_then_400()
    {
        var cast = await factory.AddCastAsync();
        var story = await factory.AddStoryAsync(cast.WorkspaceId, "Kiosk");
        var url = $"/api/workspaces/{cast.WorkspaceId}/poker-sessions";

        var none = await factory.MemberClient(cast).PostAsJsonAsync(url, new { StoryIds = Array.Empty<Guid>(), InvitedIds = Array.Empty<Guid>() });
        var outsider = await factory.MemberClient(cast).PostAsJsonAsync(url, new { StoryIds = new[] { story }, InvitedIds = new[] { cast.Outsider.ProfileId } });

        Assert.Equal(HttpStatusCode.BadRequest, none.StatusCode);
        Assert.Contains("Choose at least one story to estimate.", await none.Content.ReadAsStringAsync());
        Assert.Equal(HttpStatusCode.BadRequest, outsider.StatusCode);
        Assert.Contains("Only members of this workspace can be invited.", await outsider.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Given_an_open_session_when_another_is_started_then_409()
    {
        var (cast, first, _, _) = await StartAsync();

        var response = await factory.OwnerClient(cast).PostAsJsonAsync(
            $"/api/workspaces/{cast.WorkspaceId}/poker-sessions", new { StoryIds = new[] { first }, InvitedIds = Array.Empty<Guid>() });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Theory]
    [InlineData("staff", HttpStatusCode.Forbidden)]
    [InlineData("outsider", HttpStatusCode.NotFound)]
    public async Task Given_staff_or_an_outsider_when_they_start_a_session_then_refused(string who, HttpStatusCode expected)
    {
        var cast = await factory.AddCastAsync();
        var story = await factory.AddStoryAsync(cast.WorkspaceId, "Kiosk");
        var client = who == "staff" ? factory.StaffClient(cast) : factory.OutsiderClient(cast);

        var response = await client.PostAsJsonAsync(
            $"/api/workspaces/{cast.WorkspaceId}/poker-sessions", new { StoryIds = new[] { story }, InvitedIds = Array.Empty<Guid>() });

        Assert.Equal(expected, response.StatusCode);
    }

    [Fact]
    public async Task Given_no_session_when_a_member_opens_planning_poker_then_204()
    {
        var cast = await factory.AddCastAsync();

        var response = await factory.MemberClient(cast).GetAsync($"/api/workspaces/{cast.WorkspaceId}/poker-sessions/current");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task Given_a_vote_when_others_read_the_session_then_they_see_who_voted_but_not_the_value_and_a_change_is_broadcast()
    {
        var (cast, _, _, id) = await StartAsync();

        var response = await factory.OwnerClient(cast).PutAsJsonAsync($"/api/poker-sessions/{id}/vote", new { Value = "8" });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Contains(id, factory.Live.PokerChanges);
        var asFacilitator = await CurrentAsync(factory.MemberClient(cast), cast.WorkspaceId);
        var grace = asFacilitator!.Participants.Single(p => p.ProfileId == cast.Owner.ProfileId);
        Assert.Equal((true, (string?)null), (grace.HasVoted, grace.Vote));
        var asGrace = await CurrentAsync(factory.OwnerClient(cast), cast.WorkspaceId);
        Assert.Equal("8", asGrace!.MyVote);
    }

    [Fact]
    public async Task Given_a_vote_when_the_participant_withdraws_it_then_they_are_still_choosing()
    {
        var (cast, _, _, id) = await StartAsync();
        await factory.OwnerClient(cast).PutAsJsonAsync($"/api/poker-sessions/{id}/vote", new { Value = "8" });

        await factory.OwnerClient(cast).PutAsJsonAsync($"/api/poker-sessions/{id}/vote", new { Value = (string?)null });

        var session = await CurrentAsync(factory.OwnerClient(cast), cast.WorkspaceId);
        Assert.Equal(((string?)null, false), (session!.MyVote, session.Participants.Single(p => p.ProfileId == cast.Owner.ProfileId).HasVoted));
    }

    [Fact]
    public async Task Given_a_card_outside_the_deck_then_400()
    {
        var (cast, _, _, id) = await StartAsync();

        var response = await factory.OwnerClient(cast).PutAsJsonAsync($"/api/poker-sessions/{id}/vote", new { Value = "4" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Given_the_facilitator_when_they_reveal_then_everyone_sees_every_vote()
    {
        var (cast, _, _, id) = await StartAsync();
        await factory.OwnerClient(cast).PutAsJsonAsync($"/api/poker-sessions/{id}/vote", new { Value = "8" });
        await factory.MemberClient(cast).PutAsJsonAsync($"/api/poker-sessions/{id}/vote", new { Value = "?" });

        Assert.Equal(HttpStatusCode.NoContent, (await factory.MemberClient(cast).PostAsync($"/api/poker-sessions/{id}/reveal", null)).StatusCode);

        var asStaff = await CurrentAsync(factory.StaffClient(cast), cast.WorkspaceId);
        Assert.True(asStaff!.IsRevealed);
        Assert.Equal(["?", "8"], asStaff.Participants.Select(p => p.Vote));
    }

    [Fact]
    public async Task Given_revealed_votes_when_the_facilitator_starts_a_revote_then_the_votes_are_cleared()
    {
        var (cast, _, _, id) = await StartAsync();
        await factory.OwnerClient(cast).PutAsJsonAsync($"/api/poker-sessions/{id}/vote", new { Value = "8" });
        await factory.MemberClient(cast).PostAsync($"/api/poker-sessions/{id}/reveal", null);

        Assert.Equal(HttpStatusCode.NoContent, (await factory.MemberClient(cast).PostAsync($"/api/poker-sessions/{id}/revote", null)).StatusCode);

        var session = await CurrentAsync(factory.OwnerClient(cast), cast.WorkspaceId);
        Assert.Equal((false, (string?)null), (session!.IsRevealed, session.MyVote));
        Assert.All(session.Participants, p => Assert.False(p.HasVoted));
    }

    [Fact]
    public async Task Given_the_facilitator_when_they_set_the_points_then_the_story_updates_and_the_next_story_is_up()
    {
        var (cast, first, _, id) = await StartAsync();

        var response = await factory.MemberClient(cast).PostAsJsonAsync($"/api/poker-sessions/{id}/points", new { Points = 8 });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(8, (await factory.LoadItemAsync(first)).StoryPoints);
        var session = await CurrentAsync(factory.OwnerClient(cast), cast.WorkspaceId);
        Assert.Equal((2, "Volunteer check-in kiosk", "Shelter problem briefs", (int?)8), (session!.StoryNumber, session.Story.Title, session.LastStoryTitle, session.LastPoints));
    }

    [Theory]
    [InlineData("reveal")]
    [InlineData("revote")]
    [InlineData("points")]
    [InlineData("end")]
    public async Task Given_a_participant_who_does_not_facilitate_when_they_run_the_session_then_403(string action)
    {
        var (cast, first, _, id) = await StartAsync();

        var response = await factory.OwnerClient(cast).PostAsJsonAsync($"/api/poker-sessions/{id}/{action}", new { Points = 5 });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Null((await factory.LoadItemAsync(first)).StoryPoints);
    }

    [Fact]
    public async Task Given_staff_when_they_watch_then_they_can_read_but_not_vote_and_an_outsider_is_refused()
    {
        var (cast, _, _, id) = await StartAsync();

        var asStaff = await CurrentAsync(factory.StaffClient(cast), cast.WorkspaceId);
        Assert.False(asStaff!.CanVote);
        Assert.Equal(HttpStatusCode.Forbidden, (await factory.StaffClient(cast).PutAsJsonAsync($"/api/poker-sessions/{id}/vote", new { Value = "3" })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await factory.OutsiderClient(cast).GetAsync($"/api/workspaces/{cast.WorkspaceId}/poker-sessions/current")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await factory.OutsiderClient(cast).GetAsync($"/api/poker-sessions/{id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await factory.OutsiderClient(cast).PutAsJsonAsync($"/api/poker-sessions/{id}/vote", new { Value = "3" })).StatusCode);
    }

    [Fact]
    public async Task Given_the_facilitator_when_they_end_the_session_or_set_the_last_points_then_no_session_is_running()
    {
        var (cast, _, _, id) = await StartAsync();

        Assert.Equal(HttpStatusCode.NoContent, (await factory.MemberClient(cast).PostAsync($"/api/poker-sessions/{id}/end", null)).StatusCode);

        Assert.Equal(HttpStatusCode.NoContent, (await factory.MemberClient(cast).GetAsync($"/api/workspaces/{cast.WorkspaceId}/poker-sessions/current")).StatusCode);
        var stored = await factory.WithDbAsync(db => db.PokerSessions.AsNoTracking().SingleAsync(s => s.Id == id));
        Assert.True(stored.IsClosed);
    }

    [Fact]
    public async Task Given_a_reconnecting_participant_when_they_read_the_session_by_id_then_their_vote_is_intact()
    {
        var (cast, _, _, id) = await StartAsync();
        await factory.OwnerClient(cast).PutAsJsonAsync($"/api/poker-sessions/{id}/vote", new { Value = "13" });

        var session = await factory.OwnerClient(cast).GetFromJsonAsync<Session>($"/api/poker-sessions/{id}");

        Assert.Equal("13", session!.MyVote);
        Assert.Equal(DeckValue.Thirteen, (await factory.WithDbAsync(db => db.PokerSessions.AsNoTracking().SingleAsync(s => s.Id == id))).CurrentVoteOf(cast.Owner.ProfileId));
    }
}
