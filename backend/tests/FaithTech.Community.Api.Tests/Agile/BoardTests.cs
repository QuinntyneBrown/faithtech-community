// Traces to: L2-031 AC3, AC5, AC6, L2-034
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Hubs;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Application.Agile;
using FaithTech.Community.Domain.Agile;
using FaithTech.Community.Domain.Profiles;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;

namespace FaithTech.Community.Api.Tests.Agile;

public class BoardTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    public record Card(Guid Id, string Title, Guid? AssigneeId, string? AssigneeName, int? StoryPoints, int TasksDone, int TasksTotal);

    public record Column(string Status, Card[] Cards);

    public record SprintSummary(Guid Id, string Name, string Goal, DateOnly StartDate, DateOnly EndDate, int CompletedPoints, int TotalPoints);

    public record Board(string Method, SprintSummary? Sprint, Column[] Columns);

    [Fact]
    public async Task Given_a_kanban_workspace_when_the_board_is_shown_then_stories_sit_in_three_fixed_columns_with_task_counts()
    {
        var cast = await factory.AddCastAsync(WorkspaceMethod.Kanban);
        var kiosk = await factory.AddStoryAsync(cast.WorkspaceId, "Volunteer check-in kiosk", points: 5, assigneeId: cast.Member.ProfileId);
        await factory.AddItemAsync(cast.WorkspaceId, WorkItemKind.Task, "Buy tablets", kiosk, done: true);
        await factory.AddItemAsync(cast.WorkspaceId, WorkItemKind.Task, "Print signs", kiosk);
        await factory.AddStoryAsync(cast.WorkspaceId, "Judging rubric", WorkItemStatus.InProgress, 3);
        await factory.AddStoryAsync(cast.WorkspaceId, "Registration page", WorkItemStatus.Done, 5);
        await factory.AddItemAsync(cast.WorkspaceId, WorkItemKind.Epic, "Not a card");

        var board = (await factory.MemberClient(cast).GetFromJsonAsync<Board>($"/api/workspaces/{cast.WorkspaceId}/board"))!;

        Assert.Equal(("Kanban", null), (board.Method, board.Sprint));
        Assert.Equal(["ToDo", "InProgress", "Done"], board.Columns.Select(c => c.Status));
        var card = Assert.Single(board.Columns[0].Cards);
        Assert.Equal(("Volunteer check-in kiosk", "Ruth Alvarez", 5, 1, 2), (card.Title, card.AssigneeName, card.StoryPoints, card.TasksDone, card.TasksTotal));
        Assert.Equal(["Judging rubric"], board.Columns[1].Cards.Select(c => c.Title));
        Assert.Equal(["Registration page"], board.Columns[2].Cards.Select(c => c.Title));
    }

    [Fact]
    public async Task Given_a_scrum_workspace_when_the_board_is_shown_then_only_stories_in_the_active_sprint_appear()
    {
        var cast = await factory.AddCastAsync();
        var sprint = await factory.AddSprintAsync(cast.WorkspaceId);
        await factory.AddStoryAsync(cast.WorkspaceId, "In the sprint", WorkItemStatus.Done, 6, sprint);
        await factory.AddStoryAsync(cast.WorkspaceId, "Also in it", WorkItemStatus.InProgress, 18, sprint);
        await factory.AddStoryAsync(cast.WorkspaceId, "Still in the backlog");

        var board = (await factory.OwnerClient(cast).GetFromJsonAsync<Board>($"/api/workspaces/{cast.WorkspaceId}/board"))!;

        Assert.Equal(["In the sprint", "Also in it"], board.Columns.SelectMany(c => c.Cards).Select(c => c.Title).Order().Reverse());
        Assert.Equal(("Sprint 7", "Hackathon ready for registration", 6, 24), (board.Sprint!.Name, board.Sprint.Goal, board.Sprint.CompletedPoints, board.Sprint.TotalPoints));
    }

    [Fact]
    public async Task Given_a_scrum_workspace_with_no_active_sprint_when_the_board_is_shown_then_it_is_empty()
    {
        var cast = await factory.AddCastAsync();
        await factory.AddStoryAsync(cast.WorkspaceId, "Backlog story");

        var board = (await factory.OwnerClient(cast).GetFromJsonAsync<Board>($"/api/workspaces/{cast.WorkspaceId}/board"))!;

        Assert.Null(board.Sprint);
        Assert.All(board.Columns, c => Assert.Empty(c.Cards));
    }

    [Fact]
    public async Task Given_a_kanban_board_filtered_by_epic_then_only_its_stories_appear()
    {
        var cast = await factory.AddCastAsync(WorkspaceMethod.Kanban);
        var epic = await factory.AddItemAsync(cast.WorkspaceId, WorkItemKind.Epic, "Partner sponsorships");
        await factory.AddStoryAsync(cast.WorkspaceId, "Grant proposal", epicId: epic);
        await factory.AddStoryAsync(cast.WorkspaceId, "Unrelated");

        var board = (await factory.OwnerClient(cast).GetFromJsonAsync<Board>($"/api/workspaces/{cast.WorkspaceId}/board?epicId={epic}"))!;

        Assert.Equal(["Grant proposal"], board.Columns.SelectMany(c => c.Cards).Select(c => c.Title));
    }

    [Fact]
    public async Task Given_a_member_when_they_move_a_card_then_its_status_changes_and_open_viewers_are_told()
    {
        var cast = await factory.AddCastAsync(WorkspaceMethod.Kanban);
        var story = await factory.AddStoryAsync(cast.WorkspaceId, "Volunteer check-in kiosk");

        var response = await factory.MemberClient(cast).PutAsJsonAsync($"/api/items/{story}/status", new { Status = "InProgress" });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(WorkItemStatus.InProgress, (await factory.LoadItemAsync(story)).Status);
        Assert.Contains((cast.WorkspaceId, story, "InProgress"), factory.Live.CardMoves);
    }

    [Fact]
    public async Task Given_a_status_change_from_the_item_page_then_open_board_viewers_are_told_too()
    {
        var cast = await factory.AddCastAsync(WorkspaceMethod.Kanban);
        var story = await factory.AddStoryAsync(cast.WorkspaceId, "Kiosk");

        await factory.MemberClient(cast).PutAsJsonAsync($"/api/items/{story}", new { Title = "Kiosk", Description = "", Status = "Done" });

        Assert.Contains((cast.WorkspaceId, story, "Done"), factory.Live.CardMoves);
    }

    [Theory]
    [InlineData("staff", HttpStatusCode.Forbidden)]
    [InlineData("outsider", HttpStatusCode.NotFound)]
    public async Task Given_staff_or_an_outsider_when_they_move_a_card_then_refused(string who, HttpStatusCode expected)
    {
        var cast = await factory.AddCastAsync(WorkspaceMethod.Kanban);
        var story = await factory.AddStoryAsync(cast.WorkspaceId, "Kiosk");
        var client = who == "staff" ? factory.StaffClient(cast) : factory.OutsiderClient(cast);

        var response = await client.PutAsJsonAsync($"/api/items/{story}/status", new { Status = "Done" });

        Assert.Equal(expected, response.StatusCode);
        Assert.Equal(WorkItemStatus.ToDo, (await factory.LoadItemAsync(story)).Status);
    }

    [Fact]
    public async Task Given_an_outsider_when_they_request_the_board_then_404()
    {
        var cast = await factory.AddCastAsync();

        Assert.Equal(HttpStatusCode.NotFound, (await factory.OutsiderClient(cast).GetAsync($"/api/workspaces/{cast.WorkspaceId}/board")).StatusCode);
    }

    [Fact]
    public async Task Given_a_task_when_someone_tries_to_move_it_then_409()
    {
        var cast = await factory.AddCastAsync(WorkspaceMethod.Kanban);
        var story = await factory.AddStoryAsync(cast.WorkspaceId, "Kiosk");
        var task = await factory.AddItemAsync(cast.WorkspaceId, WorkItemKind.Task, "Buy tablets", story);

        var response = await factory.MemberClient(cast).PutAsJsonAsync($"/api/items/{task}/status", new { Status = "Done" });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task Given_an_unknown_status_then_400()
    {
        var cast = await factory.AddCastAsync(WorkspaceMethod.Kanban);
        var story = await factory.AddStoryAsync(cast.WorkspaceId, "Kiosk");

        var response = await factory.MemberClient(cast).PutAsJsonAsync($"/api/items/{story}/status", new { Status = "Blocked" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Given_two_open_boards_when_a_member_moves_a_card_then_the_other_viewer_sees_it_within_two_seconds_over_signalr()
    {
        var cast = await factory.AddCastAsync(WorkspaceMethod.Kanban);
        var story = await factory.AddStoryAsync(cast.WorkspaceId, "Kiosk");
        await using var live = factory.WithWebHostBuilder(b => b
            .ConfigureServices(s => s
                .AddAuthentication(TestAuthHandler.SchemeName)
                .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(TestAuthHandler.SchemeName, null))
            .ConfigureTestServices(s => s.AddScoped<IBoardNotifier, SignalRAgileNotifier>()));
        var viewer = Connect(live, cast.Owner, Role.CityLead);
        var moved = new TaskCompletionSource<(Guid, string)>();
        viewer.On<Guid, string>("CardMoved", (id, status) => moved.TrySetResult((id, status)));
        await viewer.StartAsync();
        await viewer.InvokeAsync("WatchBoard", cast.WorkspaceId);
        var mover = live.CreateClient();
        mover.DefaultRequestHeaders.Add(TestAuthHandler.Header, $"{cast.Member.UserId};Volunteer");

        await mover.PutAsJsonAsync($"/api/items/{story}/status", new { Status = "Done" });

        Assert.Equal((story, "Done"), await moved.Task.WaitAsync(TimeSpan.FromSeconds(2)));
        await viewer.DisposeAsync();
    }

    [Fact]
    public async Task Given_an_outsider_when_they_try_to_watch_a_board_then_the_hub_refuses()
    {
        var cast = await factory.AddCastAsync(WorkspaceMethod.Kanban);
        await using var live = factory.WithWebHostBuilder(b => b.ConfigureServices(s => s
            .AddAuthentication(TestAuthHandler.SchemeName)
            .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(TestAuthHandler.SchemeName, null)));
        var outsider = Connect(live, cast.Outsider, Role.Volunteer);
        await outsider.StartAsync();

        await Assert.ThrowsAsync<HubException>(() => outsider.InvokeAsync("WatchBoard", cast.WorkspaceId));
        await outsider.DisposeAsync();
    }

    private static HubConnection Connect(Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactory<Program> server, ProfileClients.Member member, Role role) =>
        new HubConnectionBuilder()
            .WithUrl(new Uri(server.Server.BaseAddress, "/hubs/agile"), options =>
            {
                options.Transports = HttpTransportType.LongPolling;
                options.HttpMessageHandlerFactory = _ => server.Server.CreateHandler();
                options.Headers[TestAuthHandler.Header] = $"{member.UserId};{role}";
            })
            .Build();
}
