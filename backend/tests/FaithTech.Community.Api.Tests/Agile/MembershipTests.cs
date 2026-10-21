// Traces to: L2-031, L2-041, L2-051
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Agile;
using FaithTech.Community.Domain.Notifications;
using FaithTech.Community.Domain.Profiles;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Agile;

public class MembershipTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    public record Candidate(Guid ProfileId, string Name, string[] Roles);

    [Fact]
    public async Task Given_the_owner_when_they_add_team_members_then_they_join_and_each_is_notified_in_app_and_by_email()
    {
        var cast = await factory.AddCastAsync();
        var marcus = await factory.AddWithRolesAsync("Marcus Lee", Role.EventLead);

        var response = await factory.OwnerClient(cast).PostAsJsonAsync(
            $"/api/workspaces/{cast.WorkspaceId}/members", new { ProfileIds = new[] { marcus.ProfileId } });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.True((await factory.LoadWorkspaceAsync(cast.WorkspaceId)).IsMember(marcus.ProfileId));
        var notification = await factory.WithDbAsync(db => db.Notifications.SingleAsync(n => n.RecipientId == marcus.ProfileId));
        Assert.Equal(NotificationKind.WorkspaceMemberAdded, notification.Kind);
        Assert.Single(factory.Emails.SentTo(await factory.EmailOfAsync(marcus)));
    }

    [Theory]
    [InlineData(Role.Attendee)]
    [InlineData(Role.Staff)]
    public async Task Given_a_profile_without_a_lead_or_volunteer_role_when_the_owner_adds_it_then_400(Role role)
    {
        var cast = await factory.AddCastAsync();
        var jonah = await factory.AddWithRolesAsync("Jonah Bell", role);

        var response = await factory.OwnerClient(cast).PostAsJsonAsync(
            $"/api/workspaces/{cast.WorkspaceId}/members", new { ProfileIds = new[] { jonah.ProfileId } });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.False((await factory.LoadWorkspaceAsync(cast.WorkspaceId)).IsMember(jonah.ProfileId));
    }

    [Fact]
    public async Task Given_no_one_chosen_when_the_owner_adds_members_then_400()
    {
        var cast = await factory.AddCastAsync();

        var response = await factory.OwnerClient(cast).PostAsJsonAsync(
            $"/api/workspaces/{cast.WorkspaceId}/members", new { ProfileIds = Array.Empty<Guid>() });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Theory]
    [InlineData("member", HttpStatusCode.Forbidden)]
    [InlineData("staff", HttpStatusCode.Forbidden)]
    [InlineData("outsider", HttpStatusCode.NotFound)]
    public async Task Given_anyone_but_the_owner_or_admin_when_they_manage_members_or_settings_then_refused(string who, HttpStatusCode expected)
    {
        var cast = await factory.AddCastAsync();
        var marcus = await factory.AddWithRolesAsync("Marcus Lee", Role.EventLead);
        var client = who switch
        {
            "member" => factory.MemberClient(cast),
            "staff" => factory.StaffClient(cast),
            _ => factory.OutsiderClient(cast),
        };

        var add = await client.PostAsJsonAsync($"/api/workspaces/{cast.WorkspaceId}/members", new { ProfileIds = new[] { marcus.ProfileId } });
        var remove = await client.DeleteAsync($"/api/workspaces/{cast.WorkspaceId}/members/{cast.Member.ProfileId}");
        var rename = await client.PutAsJsonAsync($"/api/workspaces/{cast.WorkspaceId}", new { Name = "Renamed" });
        var candidates = await client.GetAsync($"/api/workspaces/{cast.WorkspaceId}/candidates");

        Assert.Equal([expected, expected, expected, expected], new[] { add.StatusCode, remove.StatusCode, rename.StatusCode, candidates.StatusCode });
        var workspace = await factory.LoadWorkspaceAsync(cast.WorkspaceId);
        Assert.Equal(("Toronto team", false, true), (workspace.Name, workspace.IsMember(marcus.ProfileId), workspace.IsMember(cast.Member.ProfileId)));
    }

    [Fact]
    public async Task Given_a_system_admin_when_they_add_and_remove_members_then_it_succeeds_and_each_action_is_audited()
    {
        var cast = await factory.AddCastAsync();
        var marcus = await factory.AddWithRolesAsync("Marcus Lee", Role.EventLead);
        var admin = factory.AdminClient(cast);

        var add = await admin.PostAsJsonAsync($"/api/workspaces/{cast.WorkspaceId}/members", new { ProfileIds = new[] { marcus.ProfileId } });
        var remove = await admin.DeleteAsync($"/api/workspaces/{cast.WorkspaceId}/members/{cast.Member.ProfileId}");

        Assert.Equal((HttpStatusCode.NoContent, HttpStatusCode.NoContent), (add.StatusCode, remove.StatusCode));
        var entries = await factory.WithDbAsync(db => db.AuditEntries.Where(a => a.TargetId == cast.WorkspaceId.ToString()).ToListAsync());
        Assert.Equal(["workspace.member.added", "workspace.member.removed"], entries.Select(e => e.Action).Order());
        Assert.All(entries, e => Assert.Equal(cast.Admin.ProfileId, e.ActorId));
    }

    [Fact]
    public async Task Given_the_owner_acting_in_their_own_workspace_then_nothing_is_audited()
    {
        var cast = await factory.AddCastAsync();
        var marcus = await factory.AddWithRolesAsync("Marcus Lee", Role.EventLead);

        await factory.OwnerClient(cast).PostAsJsonAsync($"/api/workspaces/{cast.WorkspaceId}/members", new { ProfileIds = new[] { marcus.ProfileId } });

        Assert.False(await factory.WithDbAsync(db => db.AuditEntries.AnyAsync(a => a.TargetId == cast.WorkspaceId.ToString())));
    }

    [Fact]
    public async Task Given_a_removed_member_when_the_removal_completes_then_their_assigned_items_become_unassigned()
    {
        var cast = await factory.AddCastAsync();
        var (storyId, taskId, otherId) = await factory.WithDbAsync(async db =>
        {
            var workspace = await db.Workspaces.SingleAsync(w => w.Id == cast.WorkspaceId);
            var story = new WorkItem(workspace.Id, WorkItemKind.Story, "Volunteer check-in kiosk", "", null);
            var task = new WorkItem(workspace.Id, WorkItemKind.Task, "Buy tablets", "", story);
            var other = new WorkItem(workspace.Id, WorkItemKind.Story, "Owner's story", "", null);
            story.Assign(cast.Member.ProfileId, workspace);
            task.Assign(cast.Member.ProfileId, workspace);
            other.Assign(cast.Owner.ProfileId, workspace);
            db.WorkItems.AddRange(story, task, other);
            await db.SaveChangesAsync();
            return (story.Id, task.Id, other.Id);
        });

        var response = await factory.OwnerClient(cast).DeleteAsync($"/api/workspaces/{cast.WorkspaceId}/members/{cast.Member.ProfileId}");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var assignees = await factory.WithDbAsync(db => db.WorkItems.AsNoTracking()
            .Where(i => i.WorkspaceId == cast.WorkspaceId).ToDictionaryAsync(i => i.Id, i => i.AssigneeId));
        Assert.Equal((null, null, cast.Owner.ProfileId), (assignees[storyId], assignees[taskId], assignees[otherId]));
        Assert.False((await factory.LoadWorkspaceAsync(cast.WorkspaceId)).IsMember(cast.Member.ProfileId));
        Assert.Equal(HttpStatusCode.NotFound, (await factory.MemberClient(cast).GetAsync($"/api/workspaces/{cast.WorkspaceId}")).StatusCode);
    }

    [Fact]
    public async Task Given_the_owner_when_someone_tries_to_remove_them_then_409()
    {
        var cast = await factory.AddCastAsync();

        var response = await factory.AdminClient(cast).DeleteAsync($"/api/workspaces/{cast.WorkspaceId}/members/{cast.Owner.ProfileId}");

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("The owner can’t be removed from their workspace.", (await response.Content.ReadFromJsonAsync<ProblemDetails>())!.Detail);
    }

    [Fact]
    public async Task Given_the_owner_when_they_list_candidates_then_only_team_members_who_have_not_joined_are_offered()
    {
        var cast = await factory.AddCastAsync();
        var marcus = await factory.AddWithRolesAsync("Marcus Lee", Role.EventLead, Role.ProductEngineer);
        var jonah = await factory.AddWithRolesAsync("Jonah Bell", Role.Attendee);

        var candidates = (await factory.OwnerClient(cast).GetFromJsonAsync<Candidate[]>($"/api/workspaces/{cast.WorkspaceId}/candidates"))!;

        var ids = candidates.Select(c => c.ProfileId).ToList();
        Assert.Contains(marcus.ProfileId, ids);
        Assert.DoesNotContain(jonah.ProfileId, ids);
        Assert.DoesNotContain(cast.Member.ProfileId, ids);
        Assert.DoesNotContain(cast.Owner.ProfileId, ids);
        Assert.Equal(["EventLead", "ProductEngineer"], candidates.Single(c => c.ProfileId == marcus.ProfileId).Roles);
    }

    [Fact]
    public async Task Given_a_city_lead_creating_a_workspace_when_they_list_candidates_then_every_team_member_but_themselves_is_offered()
    {
        var grace = await factory.AddWithRolesAsync("Grace Okonkwo", Role.CityLead);
        var ruth = await factory.AddWithRolesAsync("Ruth Alvarez", Role.Volunteer);

        var candidates = (await factory.ClientFor(grace, Role.CityLead).GetFromJsonAsync<Candidate[]>("/api/workspaces/candidates"))!;

        Assert.Contains(candidates, c => c.ProfileId == ruth.ProfileId);
        Assert.DoesNotContain(candidates, c => c.ProfileId == grace.ProfileId);
        Assert.Equal(HttpStatusCode.Forbidden, (await factory.ClientFor(ruth, Role.Volunteer).GetAsync("/api/workspaces/candidates")).StatusCode);
    }

    [Fact]
    public async Task Given_the_owner_when_they_rename_the_workspace_then_the_name_changes()
    {
        var cast = await factory.AddCastAsync();

        var response = await factory.OwnerClient(cast).PutAsJsonAsync($"/api/workspaces/{cast.WorkspaceId}", new { Name = " Toronto city team " });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal("Toronto city team", (await factory.LoadWorkspaceAsync(cast.WorkspaceId)).Name);
    }

    [Fact]
    public async Task Given_an_empty_name_when_the_owner_saves_settings_then_an_inline_error_asks_for_a_name()
    {
        var cast = await factory.AddCastAsync();

        var response = await factory.OwnerClient(cast).PutAsJsonAsync($"/api/workspaces/{cast.WorkspaceId}", new { Name = " " });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = (await response.Content.ReadFromJsonAsync<ValidationProblemDetails>())!;
        Assert.Equal(["Give the workspace a name your team will recognise."], problem.Errors["Name"]);
    }
}
