// Traces to: L2-031 AC4, AC7, L2-036
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Domain.Agile;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Agile;

public class SwitchMethodTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    [Fact]
    public async Task Given_the_owner_when_they_switch_from_scrum_to_kanban_then_every_item_keeps_its_status_and_the_open_sprint_closes()
    {
        var cast = await factory.AddCastAsync();
        var sprint = await factory.AddSprintAsync(cast.WorkspaceId);
        var started = await factory.AddStoryAsync(cast.WorkspaceId, "Briefs", WorkItemStatus.InProgress, 8, sprint);
        var done = await factory.AddStoryAsync(cast.WorkspaceId, "Registration", WorkItemStatus.Done, 5, sprint);

        var response = await factory.OwnerClient(cast).PutAsJsonAsync($"/api/workspaces/{cast.WorkspaceId}/method", new { Method = "Kanban" });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(WorkspaceMethod.Kanban, (await factory.LoadWorkspaceAsync(cast.WorkspaceId)).Method);
        var closed = await factory.WithDbAsync(db => db.Sprints.AsNoTracking().SingleAsync(s => s.Id == sprint));
        Assert.Equal((SprintState.Closed, (int?)5), (closed.State, closed.CompletedPoints));
        Assert.Equal((WorkItemStatus.InProgress, WorkItemStatus.Done), ((await factory.LoadItemAsync(started)).Status, (await factory.LoadItemAsync(done)).Status));
    }

    [Fact]
    public async Task Given_the_owner_when_they_switch_from_kanban_to_scrum_then_stories_not_done_are_placed_in_the_backlog()
    {
        var cast = await factory.AddCastAsync(WorkspaceMethod.Kanban);
        var todo = await factory.AddStoryAsync(cast.WorkspaceId, "Kiosk");
        var started = await factory.AddStoryAsync(cast.WorkspaceId, "Briefs", WorkItemStatus.InProgress);

        var response = await factory.OwnerClient(cast).PutAsJsonAsync($"/api/workspaces/{cast.WorkspaceId}/method", new { Method = "Scrum" });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var stories = new[] { await factory.LoadItemAsync(todo), await factory.LoadItemAsync(started) };
        Assert.All(stories, s => Assert.Null(s.SprintId));
        Assert.Equal(WorkItemStatus.InProgress, stories[1].Status);
        Assert.Equal(WorkspaceMethod.Scrum, (await factory.LoadWorkspaceAsync(cast.WorkspaceId)).Method);
    }

    [Fact]
    public async Task Given_the_current_method_when_the_owner_switches_to_it_then_409()
    {
        var cast = await factory.AddCastAsync();

        var response = await factory.OwnerClient(cast).PutAsJsonAsync($"/api/workspaces/{cast.WorkspaceId}/method", new { Method = "Scrum" });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task Given_an_unknown_method_then_400()
    {
        var cast = await factory.AddCastAsync();

        var response = await factory.OwnerClient(cast).PutAsJsonAsync($"/api/workspaces/{cast.WorkspaceId}/method", new { Method = "Waterfall" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Theory]
    [InlineData("member", HttpStatusCode.Forbidden)]
    [InlineData("staff", HttpStatusCode.Forbidden)]
    [InlineData("outsider", HttpStatusCode.NotFound)]
    public async Task Given_anyone_but_the_owner_or_admin_when_they_switch_then_refused(string who, HttpStatusCode expected)
    {
        var cast = await factory.AddCastAsync();
        var client = who switch
        {
            "member" => factory.MemberClient(cast),
            "staff" => factory.StaffClient(cast),
            _ => factory.OutsiderClient(cast),
        };

        var response = await client.PutAsJsonAsync($"/api/workspaces/{cast.WorkspaceId}/method", new { Method = "Kanban" });

        Assert.Equal(expected, response.StatusCode);
        Assert.Equal(WorkspaceMethod.Scrum, (await factory.LoadWorkspaceAsync(cast.WorkspaceId)).Method);
    }

    [Fact]
    public async Task Given_a_system_admin_when_they_switch_the_method_then_it_is_audited()
    {
        var cast = await factory.AddCastAsync();

        await factory.AdminClient(cast).PutAsJsonAsync($"/api/workspaces/{cast.WorkspaceId}/method", new { Method = "Kanban" });

        var entry = await factory.WithDbAsync(db => db.AuditEntries.SingleAsync(a => a.TargetId == cast.WorkspaceId.ToString()));
        Assert.Equal(("workspace.method.switched", "{\"Method\":\"Scrum\"}", "{\"Method\":\"Kanban\"}"), (entry.Action, entry.BeforeJson, entry.AfterJson));
    }
}
