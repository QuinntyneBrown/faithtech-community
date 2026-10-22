// Traces to: L2-037 AC1, AC3, L2-042
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Domain.Agile;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Agile;

public class ArchiveTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    public record ArchivedItem(Guid Id, string Kind, string Title, DateTimeOffset ArchivedAt, string ArchivedByName);

    public record Summary(Guid Id, bool IsArchived);

    [Fact]
    public async Task Given_the_owner_when_they_archive_the_workspace_then_members_lose_it_and_the_owner_can_restore_it()
    {
        var cast = await factory.AddCastAsync();
        var owner = factory.OwnerClient(cast);

        Assert.Equal(HttpStatusCode.NoContent, (await owner.PostAsync($"/api/workspaces/{cast.WorkspaceId}/archive", null)).StatusCode);

        Assert.Equal(HttpStatusCode.NotFound, (await factory.MemberClient(cast).GetAsync($"/api/workspaces/{cast.WorkspaceId}")).StatusCode);
        Assert.DoesNotContain(await factory.MemberClient(cast).GetFromJsonAsync<Summary[]>("/api/workspaces") ?? [], w => w.Id == cast.WorkspaceId);
        Assert.Contains(await owner.GetFromJsonAsync<Summary[]>("/api/workspaces") ?? [], w => w.Id == cast.WorkspaceId && w.IsArchived);

        Assert.Equal(HttpStatusCode.NoContent, (await owner.PostAsync($"/api/workspaces/{cast.WorkspaceId}/restore", null)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await factory.MemberClient(cast).GetAsync($"/api/workspaces/{cast.WorkspaceId}")).StatusCode);
    }

    [Fact]
    public async Task Given_an_archived_workspace_when_the_owner_archives_it_again_then_409()
    {
        var cast = await factory.AddCastAsync();
        var owner = factory.OwnerClient(cast);
        await owner.PostAsync($"/api/workspaces/{cast.WorkspaceId}/archive", null);

        Assert.Equal(HttpStatusCode.Conflict, (await owner.PostAsync($"/api/workspaces/{cast.WorkspaceId}/archive", null)).StatusCode);
        await owner.PostAsync($"/api/workspaces/{cast.WorkspaceId}/restore", null);
        Assert.Equal(HttpStatusCode.Conflict, (await owner.PostAsync($"/api/workspaces/{cast.WorkspaceId}/restore", null)).StatusCode);
    }

    [Theory]
    [InlineData("member", HttpStatusCode.Forbidden)]
    [InlineData("staff", HttpStatusCode.Forbidden)]
    [InlineData("outsider", HttpStatusCode.NotFound)]
    public async Task Given_anyone_but_the_owner_or_admin_when_they_archive_the_workspace_then_refused(string who, HttpStatusCode expected)
    {
        var cast = await factory.AddCastAsync();

        var response = await Client(cast, who).PostAsync($"/api/workspaces/{cast.WorkspaceId}/archive", null);

        Assert.Equal(expected, response.StatusCode);
        Assert.False((await factory.LoadWorkspaceAsync(cast.WorkspaceId)).IsArchived);
    }

    [Theory]
    [InlineData("member")]
    [InlineData("staff")]
    [InlineData("outsider")]
    public async Task Given_an_archived_workspace_when_anyone_but_the_owner_or_admin_restores_it_then_404(string who)
    {
        var cast = await factory.AddCastAsync();
        await factory.OwnerClient(cast).PostAsync($"/api/workspaces/{cast.WorkspaceId}/archive", null);

        var response = await Client(cast, who).PostAsync($"/api/workspaces/{cast.WorkspaceId}/restore", null);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.True((await factory.LoadWorkspaceAsync(cast.WorkspaceId)).IsArchived);
    }

    [Fact]
    public async Task Given_a_system_admin_when_they_archive_and_restore_a_workspace_then_both_are_audited()
    {
        var cast = await factory.AddCastAsync();
        var admin = factory.AdminClient(cast);

        Assert.Equal(HttpStatusCode.NoContent, (await admin.PostAsync($"/api/workspaces/{cast.WorkspaceId}/archive", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await admin.PostAsync($"/api/workspaces/{cast.WorkspaceId}/restore", null)).StatusCode);

        var actions = await factory.WithDbAsync(db => db.AuditEntries
            .Where(a => a.TargetId == cast.WorkspaceId.ToString()).Select(a => a.Action).ToListAsync());
        Assert.Equal(["workspace.archived", "workspace.restored"], actions.Order());
    }

    [Fact]
    public async Task Given_the_owner_when_they_archive_a_story_then_it_and_its_tasks_leave_the_backlog_and_restore_brings_them_back()
    {
        var cast = await factory.AddCastAsync();
        var story = await factory.AddStoryAsync(cast.WorkspaceId, "Shelter problem briefs");
        var task = await factory.AddItemAsync(cast.WorkspaceId, WorkItemKind.Task, "Draft the brief", story);
        var owner = factory.OwnerClient(cast);

        Assert.Equal(HttpStatusCode.NoContent, (await owner.PostAsync($"/api/items/{story}/archive", null)).StatusCode);

        Assert.True((await factory.LoadItemAsync(task)).IsArchived);
        Assert.Equal(HttpStatusCode.NotFound, (await factory.MemberClient(cast).GetAsync($"/api/items/{story}")).StatusCode);
        Assert.DoesNotContain("Shelter problem briefs", await owner.GetStringAsync($"/api/workspaces/{cast.WorkspaceId}/backlog"));

        Assert.Equal(HttpStatusCode.NoContent, (await owner.PostAsync($"/api/items/{story}/restore", null)).StatusCode);
        Assert.False((await factory.LoadItemAsync(task)).IsArchived);
        Assert.Equal(HttpStatusCode.OK, (await factory.MemberClient(cast).GetAsync($"/api/items/{story}")).StatusCode);
    }

    [Theory]
    [InlineData("member", HttpStatusCode.Forbidden)]
    [InlineData("staff", HttpStatusCode.Forbidden)]
    [InlineData("outsider", HttpStatusCode.NotFound)]
    public async Task Given_anyone_but_the_owner_or_admin_when_they_archive_an_item_then_refused(string who, HttpStatusCode expected)
    {
        var cast = await factory.AddCastAsync();
        var story = await factory.AddStoryAsync(cast.WorkspaceId, "Kiosk");

        var response = await Client(cast, who).PostAsync($"/api/items/{story}/archive", null);

        Assert.Equal(expected, response.StatusCode);
        Assert.False((await factory.LoadItemAsync(story)).IsArchived);
    }

    [Fact]
    public async Task Given_a_member_when_they_restore_an_archived_item_then_403()
    {
        var cast = await factory.AddCastAsync();
        var story = await factory.AddStoryAsync(cast.WorkspaceId, "Kiosk");
        await factory.OwnerClient(cast).PostAsync($"/api/items/{story}/archive", null);

        var response = await factory.MemberClient(cast).PostAsync($"/api/items/{story}/restore", null);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.True((await factory.LoadItemAsync(story)).IsArchived);
    }

    [Fact]
    public async Task Given_archived_items_when_the_owner_opens_settings_then_each_is_listed_once_with_who_archived_it()
    {
        var cast = await factory.AddCastAsync();
        var epic = await factory.AddItemAsync(cast.WorkspaceId, WorkItemKind.Epic, "Spring retreat");
        await factory.AddStoryAsync(cast.WorkspaceId, "Book the venue", epicId: epic);
        var story = await factory.AddStoryAsync(cast.WorkspaceId, "Livestream the opening keynote");
        await factory.AddItemAsync(cast.WorkspaceId, WorkItemKind.Task, "Test the camera", story);
        var owner = factory.OwnerClient(cast);
        await owner.PostAsync($"/api/items/{epic}/archive", null);
        await owner.PostAsync($"/api/items/{story}/archive", null);

        var items = await owner.GetFromJsonAsync<ArchivedItem[]>($"/api/workspaces/{cast.WorkspaceId}/archived-items");

        Assert.Equal(
            [("Story", "Livestream the opening keynote", "Grace Okonkwo"), ("Epic", "Spring retreat", "Grace Okonkwo")],
            items!.Select(i => (i.Kind, i.Title, i.ArchivedByName)));
        Assert.Equal(HttpStatusCode.Forbidden, (await factory.MemberClient(cast).GetAsync($"/api/workspaces/{cast.WorkspaceId}/archived-items")).StatusCode);
    }

    [Fact]
    public async Task Given_a_system_admin_when_they_archive_and_restore_an_item_then_both_are_audited()
    {
        var cast = await factory.AddCastAsync();
        var story = await factory.AddStoryAsync(cast.WorkspaceId, "Kiosk");
        var admin = factory.AdminClient(cast);

        await admin.PostAsync($"/api/items/{story}/archive", null);
        await admin.PostAsync($"/api/items/{story}/restore", null);

        var actions = await factory.WithDbAsync(db => db.AuditEntries
            .Where(a => a.TargetId == story.ToString()).Select(a => a.Action).ToListAsync());
        Assert.Equal(["workitem.archived", "workitem.restored"], actions.Order());
    }

    private HttpClient Client(AgileClients.Cast cast, string who) => who switch
    {
        "member" => factory.MemberClient(cast),
        "staff" => factory.StaffClient(cast),
        _ => factory.OutsiderClient(cast),
    };
}
