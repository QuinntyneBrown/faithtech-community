// Traces to: L2-037 AC2, L2-042; L2-139 AC4
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Agile;
using FaithTech.Community.Domain.Notifications;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Agile;

public class ReassignOwnerTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    public record Workspace(Guid OwnerId, bool NeedsNewOwner);

    public record OwnerView(string Access, bool NeedsNewOwner);

    [Fact]
    public async Task Given_an_owner_who_loses_OwnWorkspaces_when_the_role_is_removed_then_each_administrator_is_notified()
    {
        var cast = await factory.AddCastAsync();

        var response = await factory.AdminClient(cast).DeleteAsync($"/api/profiles/{cast.Owner.ProfileId}/roles/CityLead");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var notification = await factory.WithDbAsync(db => db.Notifications
            .SingleAsync(n => n.RecipientId == cast.Admin.ProfileId && n.Kind == NotificationKind.WorkspaceOwnerLostCapability));
        Assert.Equal(
            ("Grace Okonkwo no longer holds a role that can own workspaces: Toronto team", $"/workspaces/{cast.WorkspaceId}/settings"),
            (notification.Title, notification.LinkPath));
        var workspace = await factory.AdminClient(cast).GetFromJsonAsync<Workspace>($"/api/workspaces/{cast.WorkspaceId}");
        Assert.True(workspace!.NeedsNewOwner);
    }

    // L2-139 AC4: one notification per administrator lists every workspace that needs a new owner.
    [Fact]
    public async Task Given_an_owner_of_two_workspaces_who_loses_OwnWorkspaces_then_each_administrator_gets_one_notification_listing_both()
    {
        var cast = await factory.AddCastAsync();
        await factory.AddWorkspaceAsync(cast.Owner, "Austin crew", WorkspaceMethod.Kanban, cast.Member);

        await factory.AdminClient(cast).DeleteAsync($"/api/profiles/{cast.Owner.ProfileId}/roles/CityLead");

        var notification = await factory.WithDbAsync(db => db.Notifications
            .SingleAsync(n => n.RecipientId == cast.Admin.ProfileId && n.Kind == NotificationKind.WorkspaceOwnerLostCapability));
        Assert.Equal(
            ("Grace Okonkwo no longer holds a role that can own workspaces: Austin crew, Toronto team", "/workspaces"),
            (notification.Title, notification.LinkPath));
    }

    // L2-139 AC6: a role whose capabilities another held role still gives notifies no one.
    [Fact]
    public async Task Given_an_owner_who_keeps_OwnWorkspaces_through_another_role_then_no_one_is_notified()
    {
        var cast = await factory.AddCastAsync();
        await factory.AdminClient(cast).PostAsJsonAsync($"/api/profiles/{cast.Owner.ProfileId}/roles", new { Role = "EventLead" });

        await factory.AdminClient(cast).DeleteAsync($"/api/profiles/{cast.Owner.ProfileId}/roles/EventLead");

        Assert.False(await factory.WithDbAsync(db => db.Notifications.AnyAsync(n => n.Kind == NotificationKind.WorkspaceOwnerLostCapability && n.RecipientId == cast.Admin.ProfileId)));
    }

    [Fact]
    public async Task Given_an_archived_workspace_whose_owner_lost_city_lead_then_it_is_not_flagged_until_it_is_restored()
    {
        var cast = await factory.AddCastAsync();
        await factory.OwnerClient(cast).PostAsync($"/api/workspaces/{cast.WorkspaceId}/archive", null);

        await factory.AdminClient(cast).DeleteAsync($"/api/profiles/{cast.Owner.ProfileId}/roles/CityLead");

        var archived = (await factory.AdminClient(cast).GetFromJsonAsync<WorkspacesTests.Summary[]>("/api/workspaces"))!.Single(w => w.Id == cast.WorkspaceId);
        Assert.Equal((true, false), (archived.IsArchived, archived.NeedsNewOwner));
        Assert.False(await factory.WithDbAsync(db => db.Notifications.AnyAsync(n => n.Kind == NotificationKind.WorkspaceOwnerLostCapability && n.RecipientId == cast.Admin.ProfileId)));

        await factory.AdminClient(cast).PostAsync($"/api/workspaces/{cast.WorkspaceId}/restore", null);

        var restored = (await factory.AdminClient(cast).GetFromJsonAsync<WorkspacesTests.Summary[]>("/api/workspaces"))!.Single(w => w.Id == cast.WorkspaceId);
        Assert.Equal((false, true), (restored.IsArchived, restored.NeedsNewOwner));
    }

    [Fact]
    public async Task Given_a_workspace_needing_an_owner_when_a_system_admin_reassigns_it_to_a_city_lead_then_the_former_owner_stays_a_member_and_it_is_audited()
    {
        var cast = await factory.AddCastAsync();
        var joel = await factory.AddWithRolesAsync("Joel Mbeki", Role.CityLead);
        await factory.AdminClient(cast).DeleteAsync($"/api/profiles/{cast.Owner.ProfileId}/roles/CityLead");

        var response = await factory.AdminClient(cast).PutAsJsonAsync($"/api/workspaces/{cast.WorkspaceId}/owner", new { OwnerId = joel.ProfileId });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var workspace = await factory.LoadWorkspaceAsync(cast.WorkspaceId);
        Assert.Equal(joel.ProfileId, workspace.OwnerId);
        Assert.True(workspace.IsMember(cast.Owner.ProfileId));
        var entry = await factory.WithDbAsync(db => db.AuditEntries.SingleAsync(a => a.TargetId == cast.WorkspaceId.ToString()));
        Assert.Equal("workspace.owner.reassigned", entry.Action);
        Assert.Contains(joel.ProfileId.ToString(), entry.AfterJson);
        var asJoel = await factory.ClientFor(joel, Role.CityLead).GetFromJsonAsync<OwnerView>($"/api/workspaces/{cast.WorkspaceId}");
        Assert.Equal(("Owner", false), (asJoel!.Access, asJoel.NeedsNewOwner));
    }

    [Fact]
    public async Task Given_a_profile_without_city_lead_when_a_system_admin_picks_them_then_400_and_the_owner_is_unchanged()
    {
        var cast = await factory.AddCastAsync();

        var response = await factory.AdminClient(cast).PutAsJsonAsync($"/api/workspaces/{cast.WorkspaceId}/owner", new { OwnerId = cast.Member.ProfileId });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("Choose a City Lead.", await response.Content.ReadAsStringAsync());
        Assert.Equal(cast.Owner.ProfileId, (await factory.LoadWorkspaceAsync(cast.WorkspaceId)).OwnerId);
    }

    [Fact]
    public async Task Given_no_owner_chosen_then_400()
    {
        var cast = await factory.AddCastAsync();

        var response = await factory.AdminClient(cast).PutAsJsonAsync($"/api/workspaces/{cast.WorkspaceId}/owner", new { OwnerId = (Guid?)null });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("Choose who will own this workspace.", await response.Content.ReadAsStringAsync());
    }

    [Theory]
    [InlineData("owner", HttpStatusCode.Forbidden)]
    [InlineData("member", HttpStatusCode.Forbidden)]
    [InlineData("staff", HttpStatusCode.Forbidden)]
    [InlineData("outsider", HttpStatusCode.NotFound)]
    public async Task Given_anyone_but_a_system_admin_when_they_reassign_the_owner_then_refused(string who, HttpStatusCode expected)
    {
        var cast = await factory.AddCastAsync();
        var joel = await factory.AddWithRolesAsync("Joel Mbeki", Role.CityLead);
        var client = who switch
        {
            "owner" => factory.OwnerClient(cast),
            "member" => factory.MemberClient(cast),
            "staff" => factory.StaffClient(cast),
            _ => factory.OutsiderClient(cast),
        };

        var response = await client.PutAsJsonAsync($"/api/workspaces/{cast.WorkspaceId}/owner", new { OwnerId = joel.ProfileId });

        Assert.Equal(expected, response.StatusCode);
        Assert.Equal(cast.Owner.ProfileId, (await factory.LoadWorkspaceAsync(cast.WorkspaceId)).OwnerId);
    }

    [Fact]
    public async Task Given_a_system_admin_when_they_list_owner_candidates_then_only_city_leads_but_the_current_owner_are_offered()
    {
        var cast = await factory.AddCastAsync();
        var joel = await factory.AddWithRolesAsync("Joel Mbeki", Role.CityLead);

        var candidates = await factory.AdminClient(cast).GetFromJsonAsync<AgileCandidate[]>($"/api/workspaces/{cast.WorkspaceId}/owner-candidates");

        Assert.Contains(candidates!, c => c.ProfileId == joel.ProfileId);
        Assert.DoesNotContain(candidates!, c => c.ProfileId == cast.Owner.ProfileId || c.ProfileId == cast.Member.ProfileId);
        Assert.Equal(HttpStatusCode.Forbidden, (await factory.OwnerClient(cast).GetAsync($"/api/workspaces/{cast.WorkspaceId}/owner-candidates")).StatusCode);
    }

    public record AgileCandidate(Guid ProfileId, string Name);
}
