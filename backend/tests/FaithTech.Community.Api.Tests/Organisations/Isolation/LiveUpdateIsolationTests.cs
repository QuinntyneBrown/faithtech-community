using System.Net.Http.Json;
using FaithTech.Community.Api.Hubs;
using FaithTech.Community.Api.Tests.Agile;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Application.Agile;
using FaithTech.Community.Domain.Agile;
using FaithTech.Community.Domain.Profiles;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;

namespace FaithTech.Community.Api.Tests.Organisations.Isolation;

// Traces to: L2-130 AC2. Live Agile groups belong to one organisation: a connection on one organisation's host cannot
// watch another's board, and a board's updates reach the viewers on its own host.
public class LiveUpdateIsolationTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    [Fact]
    public async Task A_connection_on_another_organisation_cannot_watch_a_faithtech_board()
    {
        var cast = await factory.AddCastAsync(WorkspaceMethod.Kanban);
        var northside = await factory.AddOrganisationAsync();
        var ana = await factory.AddMemberAsync(northside, "Ana Lima", Role.SystemAdmin);
        await using var live = Live();
        var connection = Connect(live, northside.Origin, ana, Role.SystemAdmin);
        await connection.StartAsync();

        await Assert.ThrowsAsync<HubException>(() => connection.InvokeAsync("WatchBoard", cast.WorkspaceId));
        await connection.DisposeAsync();
    }

    [Fact]
    public async Task A_viewer_on_another_organisations_host_hears_its_own_board_move()
    {
        var northside = await factory.AddOrganisationAsync();
        var ana = await factory.AddMemberAsync(northside, "Ana Lima", Role.CityLead);
        await using var live = Live();
        var client = live.CreateClient();
        client.BaseAddress = new Uri(northside.Origin);
        client.DefaultRequestHeaders.Add(TestAuthHandler.Header, $"{ana.UserId};CityLead");
        var workspace = await (await client.PostAsJsonAsync("/api/workspaces", new { Name = "Northside launch", Method = "Kanban" })).CreatedIdAsync();
        var item = await (await client.PostAsJsonAsync($"/api/workspaces/{workspace}/items",
            new { Kind = "Initiative", Title = "Kiosk", Description = "", ParentId = (Guid?)null, AssigneeId = (Guid?)null, StoryPoints = (int?)null })).CreatedIdAsync();
        var viewer = Connect(live, northside.Origin, ana, Role.CityLead);
        var moved = new TaskCompletionSource<(Guid, string)>();
        viewer.On<Guid, string>("CardMoved", (id, status) => moved.TrySetResult((id, status)));
        await viewer.StartAsync();
        await viewer.InvokeAsync("WatchBoard", workspace);

        (await client.PutAsJsonAsync($"/api/items/{item}/status", new { Status = "Done" })).EnsureSuccessStatusCode();

        Assert.Equal((item, "Done"), await moved.Task.WaitAsync(TimeSpan.FromSeconds(2)));
        await viewer.DisposeAsync();
    }

    private WebApplicationFactory<Program> Live() =>
        factory.WithWebHostBuilder(b => b
            .ConfigureServices(s => s
                .AddAuthentication(TestAuthHandler.SchemeName)
                .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(TestAuthHandler.SchemeName, null))
            .ConfigureTestServices(s =>
            {
                s.AddScoped<IBoardNotifier, SignalRAgileNotifier>();
            }));

    private static HubConnection Connect(WebApplicationFactory<Program> server, string origin, ProfileClients.Member member, Role role) =>
        new HubConnectionBuilder()
            .WithUrl(new Uri(new Uri(origin), "/hubs/agile"), options =>
            {
                options.Transports = HttpTransportType.LongPolling;
                options.HttpMessageHandlerFactory = _ => server.Server.CreateHandler();
                options.Headers[TestAuthHandler.Header] = $"{member.UserId};{role}";
            })
            .Build();
}
