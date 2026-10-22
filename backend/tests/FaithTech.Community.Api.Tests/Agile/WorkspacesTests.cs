// Traces to: L2-031, L2-042, L2-050
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Agile;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Agile;

public class WorkspacesTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    public record Summary(Guid Id, string Name, string Method, Guid OwnerId, string OwnerName, bool IsOwner, string? ActiveSprintName, int MemberCount, bool IsArchived, bool NeedsNewOwner);

    public record Member(Guid ProfileId, string Name, string[] Roles, bool IsOwner, int AssignedStories, int AssignedTasks);

    public record Detail(Guid Id, string Name, string Method, Guid OwnerId, string OwnerName, Member[] Members, bool IsArchived, string Access, bool CanEdit, bool CanManage, bool NeedsNewOwner);

    [Theory]
    [InlineData("Scrum")]
    [InlineData("Kanban")]
    public async Task Given_a_city_lead_when_they_create_a_workspace_then_they_own_it(string method)
    {
        var grace = await factory.AddWithRolesAsync("Grace Okonkwo", Role.CityLead);

        var response = await factory.ClientFor(grace, Role.CityLead).PostAsJsonAsync("/api/workspaces", new { Name = "  Hackathon ops ", Method = method });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = (await response.Content.ReadFromJsonAsync<Detail>())!;
        Assert.Equal(("Hackathon ops", method, grace.ProfileId, "Owner", true, true), (created.Name, created.Method, created.OwnerId, created.Access, created.CanEdit, created.CanManage));
        var stored = await factory.LoadWorkspaceAsync(created.Id);
        Assert.Equal((grace.ProfileId, Enum.Parse<WorkspaceMethod>(method)), (stored.OwnerId, stored.Method));
    }

    [Fact]
    public async Task Given_a_city_lead_when_they_create_a_second_workspace_then_they_own_both()
    {
        var grace = await factory.AddWithRolesAsync("Grace Okonkwo", Role.CityLead);
        var client = factory.ClientFor(grace, Role.CityLead);

        await client.PostAsJsonAsync("/api/workspaces", new { Name = "Toronto team", Method = "Scrum" });
        await client.PostAsJsonAsync("/api/workspaces", new { Name = "Hackathon ops", Method = "Kanban" });

        var mine = (await client.GetFromJsonAsync<Summary[]>("/api/workspaces"))!.Where(w => w.OwnerId == grace.ProfileId).ToList();
        Assert.Equal(["Hackathon ops", "Toronto team"], mine.Select(w => w.Name));
        Assert.All(mine, w => Assert.True(w.IsOwner));
    }

    [Fact]
    public async Task Given_members_chosen_at_creation_when_the_workspace_is_created_then_each_joins_and_is_notified()
    {
        var grace = await factory.AddWithRolesAsync("Grace Okonkwo", Role.CityLead);
        var marcus = await factory.AddWithRolesAsync("Marcus Lee", Role.EventLead);
        var ruth = await factory.AddWithRolesAsync("Ruth Alvarez", Role.Volunteer);

        var response = await factory.ClientFor(grace, Role.CityLead).PostAsJsonAsync(
            "/api/workspaces", new { Name = "Hackathon ops", Method = "Kanban", MemberIds = new[] { marcus.ProfileId, ruth.ProfileId } });

        var created = (await response.Content.ReadFromJsonAsync<Detail>())!;
        Assert.Equal(new[] { grace.ProfileId, marcus.ProfileId, ruth.ProfileId }.Order(), created.Members.Select(m => m.ProfileId).Order());
        foreach (var member in new[] { marcus, ruth })
        {
            var notification = await factory.WithDbAsync(db => db.Notifications.SingleAsync(n => n.RecipientId == member.ProfileId));
            Assert.Equal(("Grace Okonkwo added you to the workspace Hackathon ops", $"/workspaces/{created.Id}"), (notification.Title, notification.LinkPath));
            var email = Assert.Single(await factory.QueuedEmailsToAsync(await factory.EmailOfAsync(member)));
            Assert.Equal("You’ve been added to Hackathon ops", email.Subject);
            Assert.Contains($"{CommunityApiFactory.WebAppOrigin}/workspaces/{created.Id}", email.Body);
        }
    }

    [Theory]
    [InlineData(Role.Attendee)]
    [InlineData(Role.ProductEngineer)]
    public async Task Given_a_profile_without_a_lead_or_volunteer_role_when_chosen_at_creation_then_400_and_nothing_is_saved(Role role)
    {
        var grace = await factory.AddWithRolesAsync("Grace Okonkwo", Role.CityLead);
        var jonah = await factory.AddWithRolesAsync("Jonah Bell", role);

        var response = await factory.ClientFor(grace, Role.CityLead).PostAsJsonAsync(
            "/api/workspaces", new { Name = "Not saved", Method = "Scrum", MemberIds = new[] { jonah.ProfileId } });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.False(await factory.WithDbAsync(db => db.Workspaces.AnyAsync(w => w.Name == "Not saved")));
    }

    [Theory]
    [InlineData("", "Scrum", "Name")]
    [InlineData("Ops", "Waterfall", "Method")]
    public async Task Given_an_empty_name_or_an_unknown_method_when_creating_then_400_per_field(string name, string method, string field)
    {
        var grace = await factory.AddWithRolesAsync("Grace Okonkwo", Role.CityLead);

        var response = await factory.ClientFor(grace, Role.CityLead).PostAsJsonAsync("/api/workspaces", new { Name = name, Method = method });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains($"\"{field}\"", await response.Content.ReadAsStringAsync());
    }

    [Theory]
    [InlineData(Role.Staff)]
    [InlineData(Role.EventLead)]
    [InlineData(Role.Volunteer)]
    public async Task Given_anyone_but_a_city_lead_or_system_admin_when_they_create_a_workspace_then_403(Role role)
    {
        var someone = await factory.AddWithRolesAsync("Marcus Lee", role);

        var response = await factory.ClientFor(someone, role).PostAsJsonAsync("/api/workspaces", new { Name = "Mine", Method = "Scrum" });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Given_a_member_when_they_list_workspaces_then_only_their_workspaces_are_listed_with_owner_method_and_member_count()
    {
        var cast = await factory.AddCastAsync();
        var other = await factory.AddWorkspaceAsync(cast.Owner, "Owner only");

        var list = (await factory.MemberClient(cast).GetFromJsonAsync<Summary[]>("/api/workspaces"))!;

        var only = Assert.Single(list);
        Assert.Equal((cast.WorkspaceId, "Toronto team", "Scrum", "Grace Okonkwo", false, 2), (only.Id, only.Name, only.Method, only.OwnerName, only.IsOwner, only.MemberCount));
        Assert.DoesNotContain(list, w => w.Id == other);
    }

    [Fact]
    public async Task Given_a_city_lead_when_they_list_workspaces_then_they_see_the_ones_they_own_marked_owner_and_the_ones_they_belong_to_with_the_active_sprint()
    {
        var cast = await factory.AddCastAsync();
        await factory.AddSprintAsync(cast.WorkspaceId, "Sprint 7");
        var joel = await factory.AddWithRolesAsync("Joel Mbeki", Role.CityLead);
        var joined = await factory.AddWorkspaceAsync(joel, "Hackathon ops", WorkspaceMethod.Kanban, cast.Owner);
        await factory.AddWorkspaceAsync(joel, "Not mine");

        var list = (await factory.OwnerClient(cast).GetFromJsonAsync<Summary[]>("/api/workspaces"))!;

        Assert.Equal([("Hackathon ops", false, null), ("Toronto team", true, "Sprint 7")], list.Select(w => (w.Name, w.IsOwner, w.ActiveSprintName)));
        Assert.Equal(joined, list[0].Id);
    }

    [Theory]
    [InlineData(Role.Staff)]
    [InlineData(Role.SystemAdmin)]
    public async Task Given_staff_or_system_admin_when_they_list_workspaces_then_every_workspace_is_listed(Role role)
    {
        var cast = await factory.AddCastAsync();
        var reader = await factory.AddWithRolesAsync("Reader", role);

        var list = (await factory.ClientFor(reader, role).GetFromJsonAsync<Summary[]>("/api/workspaces"))!;

        Assert.Contains(list, w => w.Id == cast.WorkspaceId);
    }

    [Fact]
    public async Task Given_an_outsider_when_they_list_workspaces_then_none_of_the_others_appear()
    {
        var cast = await factory.AddCastAsync();

        var list = (await factory.OutsiderClient(cast).GetFromJsonAsync<Summary[]>("/api/workspaces"))!;

        Assert.Empty(list);
    }

    [Theory]
    [InlineData("owner", "Owner", true, true)]
    [InlineData("member", "Member", true, false)]
    [InlineData("staff", "Staff", false, false)]
    [InlineData("admin", "Admin", true, true)]
    public async Task Given_anyone_who_may_read_when_they_open_the_workspace_then_they_see_it_with_their_access(string who, string access, bool canEdit, bool canManage)
    {
        var cast = await factory.AddCastAsync();
        var client = who switch
        {
            "owner" => factory.OwnerClient(cast),
            "member" => factory.MemberClient(cast),
            "staff" => factory.StaffClient(cast),
            _ => factory.AdminClient(cast),
        };

        var workspace = (await client.GetFromJsonAsync<Detail>($"/api/workspaces/{cast.WorkspaceId}"))!;

        Assert.Equal((access, canEdit, canManage), (workspace.Access, workspace.CanEdit, workspace.CanManage));
        Assert.Equal(["Grace Okonkwo", "Ruth Alvarez"], workspace.Members.Select(m => m.Name));
        Assert.True(workspace.Members[0].IsOwner);
        Assert.Equal(["Volunteer"], workspace.Members[1].Roles);
    }

    [Fact]
    public async Task Given_a_non_member_who_is_not_staff_or_admin_when_they_open_the_workspace_then_404()
    {
        var cast = await factory.AddCastAsync();

        var response = await factory.OutsiderClient(cast).GetAsync($"/api/workspaces/{cast.WorkspaceId}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
