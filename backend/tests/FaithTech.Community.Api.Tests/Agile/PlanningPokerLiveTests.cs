// Traces to: L2-038 AC2, AC7
using System.Net.Http.Json;
using FaithTech.Community.Api.Hubs;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Application.Agile;
using FaithTech.Community.Domain.Profiles;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;

namespace FaithTech.Community.Api.Tests.Agile;

public class PlanningPokerLiveTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    public record Session(Guid Id);

    [Fact]
    public async Task Given_staff_watching_a_session_when_a_participant_votes_then_they_hear_of_it_within_two_seconds_over_signalr()
    {
        var cast = await factory.AddCastAsync();
        var story = await factory.AddStoryAsync(cast.WorkspaceId, "Kiosk");
        await using var live = Live();
        var member = Client(live, cast.Member, Role.Volunteer);
        var started = await member.PostAsJsonAsync(
            $"/api/workspaces/{cast.WorkspaceId}/poker-sessions", new { StoryIds = new[] { story }, InvitedIds = new[] { cast.Owner.ProfileId } });
        var session = (await started.Content.ReadFromJsonAsync<Session>())!;
        var watcher = BoardTests.Connect(live, cast.Staff, Role.Staff);
        var changed = new TaskCompletionSource<Guid>();
        watcher.On<Guid>("PokerChanged", id => changed.TrySetResult(id));
        await watcher.StartAsync();
        await watcher.InvokeAsync("WatchPokerSession", session.Id);

        await Client(live, cast.Owner, Role.CityLead).PutAsJsonAsync($"/api/poker-sessions/{session.Id}/vote", new { Value = "5" });

        Assert.Equal(session.Id, await changed.Task.WaitAsync(TimeSpan.FromSeconds(2)));
        await watcher.DisposeAsync();
    }

    [Fact]
    public async Task Given_an_outsider_when_they_try_to_join_a_session_then_the_hub_refuses()
    {
        var cast = await factory.AddCastAsync();
        var story = await factory.AddStoryAsync(cast.WorkspaceId, "Kiosk");
        await using var live = Live();
        var started = await Client(live, cast.Member, Role.Volunteer).PostAsJsonAsync(
            $"/api/workspaces/{cast.WorkspaceId}/poker-sessions", new { StoryIds = new[] { story }, InvitedIds = Array.Empty<Guid>() });
        var session = (await started.Content.ReadFromJsonAsync<Session>())!;
        var outsider = BoardTests.Connect(live, cast.Outsider, Role.Volunteer);
        await outsider.StartAsync();

        await Assert.ThrowsAsync<HubException>(() => outsider.InvokeAsync("WatchPokerSession", session.Id));
        await Assert.ThrowsAsync<HubException>(() => outsider.InvokeAsync("WatchPokerSession", Guid.NewGuid()));
        await outsider.DisposeAsync();
    }

    private Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactory<Program> Live() =>
        factory.WithWebHostBuilder(b => b
            .ConfigureServices(s => s
                .AddAuthentication(TestAuthHandler.SchemeName)
                .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(TestAuthHandler.SchemeName, null))
            .ConfigureTestServices(s => s.AddScoped<IPokerBroadcaster, SignalRAgileNotifier>()));

    private static HttpClient Client(Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactory<Program> server, ProfileClients.Member member, Role role)
    {
        var client = server.CreateClient();
        client.DefaultRequestHeaders.Add(TestAuthHandler.Header, $"{member.UserId};{role}");
        return client;
    }
}
