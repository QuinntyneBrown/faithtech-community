// Traces to: L2-008, L2-009, L2-041; L2-138 AC1-AC5, AC7, AC8
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Organisations;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Notifications;
using FaithTech.Community.Domain.Profiles;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Admin;

public class AssignRolesTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    private static readonly Guid Granter = Guid.NewGuid();

    /// <summary>A held role as both role routes answer it (L2-138 AC1).</summary>
    public record HeldRole(Guid Id, string Name, Guid? ChapterId);

    [Theory]
    [InlineData(Role.EventLead)]
    [InlineData(Role.CreateLead)]
    [InlineData(Role.CommunicationsLead)]
    [InlineData(Role.Volunteer)]
    [InlineData(Role.ProductEngineer)]
    [InlineData(Role.Attendee)]
    public async Task City_lead_adds_a_permitted_role_and_the_owner_is_notified(Role role)
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var ruth = await factory.AddMemberAsync("Ruth Alvarez");

        var response = await factory.ClientFor(grace, Role.CityLead).PostAsJsonAsync($"/api/profiles/{ruth.ProfileId}/roles", new { RoleId = factory.RoleIdOf(role) });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var held = Assert.Single((await response.Content.ReadFromJsonAsync<HeldRole[]>())!);
        Assert.Equal((factory.RoleIdOf(role), (Guid?)null), (held.Id, held.ChapterId));
        Assert.True((await LoadAsync(ruth.ProfileId)).HasRole(role));
        var notification = await factory.WithDbAsync(db => db.Notifications.SingleAsync(n => n.RecipientId == ruth.ProfileId));
        Assert.Equal(NotificationKind.RoleChanged, notification.Kind);
        Assert.Equal($"Grace Okonkwo made you {held.Name}", notification.Title);
        Assert.Single(await factory.QueuedEmailsToAsync(await EmailOfAsync(ruth)));
    }

    [Fact]
    public async Task City_lead_removes_a_permitted_role_and_the_owner_is_notified()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var ruth = await factory.AddMemberAsync("Ruth Alvarez", p => { p.AddRole(Role.Volunteer, Granter, DateTime.UtcNow); p.AddRole(Role.Attendee, Granter, DateTime.UtcNow); });

        var response = await factory.ClientFor(grace, Role.CityLead).DeleteAsync($"/api/profiles/{ruth.ProfileId}/roles/{factory.RoleIdOf("Volunteer")}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(["Attendee"], (await response.Content.ReadFromJsonAsync<HeldRole[]>())!.Select(r => r.Name));
        Assert.False((await LoadAsync(ruth.ProfileId)).HasRole(Role.Volunteer));
        Assert.Equal(
            "Grace Okonkwo removed Volunteer",
            await factory.WithDbAsync(db => db.Notifications.Where(n => n.RecipientId == ruth.ProfileId && n.Kind == NotificationKind.RoleChanged).Select(n => n.Title).SingleAsync()));
    }

    [Theory]
    [InlineData(Role.CityLead)]
    [InlineData(Role.Staff)]
    [InlineData(Role.SystemAdmin)]
    public async Task City_lead_cannot_grant_or_remove_city_lead_staff_or_system_admin(Role role)
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var marcus = await factory.AddMemberAsync("Marcus Lee");
        var holder = await factory.AddMemberAsync("Daniel Reyes", p => p.AddRole(role, Granter, DateTime.UtcNow));
        var client = factory.ClientFor(grace, Role.CityLead);

        var grant = await client.PostAsJsonAsync($"/api/profiles/{marcus.ProfileId}/roles", new { RoleId = factory.RoleIdOf(role) });
        var remove = await client.DeleteAsync($"/api/profiles/{holder.ProfileId}/roles/{factory.RoleIdOf(role)}");

        Assert.Equal(HttpStatusCode.Forbidden, grant.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, remove.StatusCode);
        Assert.False((await LoadAsync(marcus.ProfileId)).HasRole(role));
        Assert.True((await LoadAsync(holder.ProfileId)).HasRole(role));
    }

    [Theory]
    [InlineData(Role.CityLead)]
    [InlineData(Role.Staff)]
    [InlineData(Role.SystemAdmin)]
    [InlineData(Role.Volunteer)]
    public async Task System_admin_grants_and_removes_any_role_and_each_change_is_audited(Role role)
    {
        var priya = await factory.AddMemberAsync("Priya Shah", p => p.AddRole(Role.SystemAdmin, Granter, DateTime.UtcNow));
        var esther = await factory.AddMemberAsync("Esther Nakamura");
        var client = factory.ClientFor(priya, Role.SystemAdmin);

        var grant = await client.PostAsJsonAsync($"/api/profiles/{esther.ProfileId}/roles", new { RoleId = factory.RoleIdOf(role) });
        var remove = await client.DeleteAsync($"/api/profiles/{esther.ProfileId}/roles/{factory.RoleIdOf(role)}");

        Assert.Equal(HttpStatusCode.OK, grant.StatusCode);
        Assert.Equal(HttpStatusCode.OK, remove.StatusCode);
        var entries = await factory.WithDbAsync(db => db.AuditEntries
            .Where(a => a.TargetId == esther.ProfileId.ToString()).OrderBy(a => a.OccurredAtUtc).ThenBy(a => a.Action).ToListAsync());
        Assert.Equal(["role.granted", "role.removed"], entries.Select(e => e.Action).Order());
        Assert.All(entries, e => Assert.Equal(priya.ProfileId, e.ActorId));
        var granted = entries.Single(e => e.Action == "role.granted");
        Assert.Equal("{\"Roles\":[]}", granted.BeforeJson);
        Assert.Equal($"{{\"Roles\":[\"{role}\"],\"Role\":\"{role}\",\"ChapterId\":null}}", granted.AfterJson);
        Assert.False(await factory.WithDbAsync(db => db.Notifications.AnyAsync(n => n.RecipientId == esther.ProfileId)));
    }

    [Fact]
    public async Task City_lead_role_changes_are_audited_too()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var jonah = await factory.AddMemberAsync("Jonah Bell");

        await factory.ClientFor(grace, Role.CityLead).PostAsJsonAsync($"/api/profiles/{jonah.ProfileId}/roles", new { RoleId = factory.RoleIdOf("Attendee") });

        var entry = await factory.WithDbAsync(db => db.AuditEntries.SingleAsync(a => a.TargetId == jonah.ProfileId.ToString()));
        Assert.Equal("role.granted", entry.Action);
        Assert.Equal(grace.ProfileId, entry.ActorId);
    }

    [Theory]
    [InlineData]
    [InlineData(Role.Staff)]
    [InlineData(Role.EventLead)]
    [InlineData(Role.Volunteer)]
    public async Task Any_other_role_gets_403(params Role[] roles)
    {
        var member = await factory.AddMemberAsync("Leah Thompson");
        var jonah = await factory.AddMemberAsync("Jonah Bell", p => p.AddRole(Role.Attendee, Granter, DateTime.UtcNow));
        var client = factory.ClientFor(member, roles);

        var grant = await client.PostAsJsonAsync($"/api/profiles/{jonah.ProfileId}/roles", new { RoleId = factory.RoleIdOf("Volunteer") });
        var remove = await client.DeleteAsync($"/api/profiles/{jonah.ProfileId}/roles/{factory.RoleIdOf("Attendee")}");

        Assert.Equal(HttpStatusCode.Forbidden, grant.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, remove.StatusCode);
        Assert.Equal([Role.Attendee], (await LoadAsync(jonah.ProfileId)).Roles.Select(r => r.Role));
    }

    [Fact]
    public async Task The_last_system_admin_role_cannot_be_removed()
    {
        // Each fixture shares one database, so clear other admins first to make this the last one.
        await factory.WithDbAsync(async db =>
        {
            foreach (var p in await db.Profiles.Where(p => p.Roles.Any(r => r.Definition!.Key == nameof(Role.SystemAdmin))).ToListAsync())
            {
                p.RemoveRole(Role.SystemAdmin);
            }

            return await db.SaveChangesAsync();
        });
        var priya = await factory.AddMemberAsync("Priya Shah", p => p.AddRole(Role.SystemAdmin, Granter, DateTime.UtcNow));
        var client = factory.ClientFor(priya, Role.SystemAdmin);

        var response = await client.DeleteAsync($"/api/profiles/{priya.ProfileId}/roles/{factory.RoleIdOf("SystemAdmin")}");

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        Assert.Equal("There must always be at least one administrator.", problem!.Detail);
        Assert.True((await LoadAsync(priya.ProfileId)).HasRole(Role.SystemAdmin));

        var second = await factory.AddMemberAsync("Second Admin", p => p.AddRole(Role.SystemAdmin, Granter, DateTime.UtcNow));
        Assert.Equal(HttpStatusCode.OK, (await client.DeleteAsync($"/api/profiles/{second.ProfileId}/roles/{factory.RoleIdOf("SystemAdmin")}")).StatusCode);
    }

    [Fact]
    public async Task A_held_role_cannot_be_added_again_nor_a_missing_one_removed()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var ruth = await factory.AddMemberAsync("Ruth Alvarez", p => p.AddRole(Role.Volunteer, Granter, DateTime.UtcNow));
        var client = factory.ClientFor(grace, Role.CityLead);

        var again = await client.PostAsJsonAsync($"/api/profiles/{ruth.ProfileId}/roles", new { RoleId = factory.RoleIdOf("Volunteer") });
        var missing = await client.DeleteAsync($"/api/profiles/{ruth.ProfileId}/roles/{factory.RoleIdOf("Attendee")}");

        Assert.Equal(HttpStatusCode.Conflict, again.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, missing.StatusCode);
    }

    // L2-138 AC7: an archived role, or one of another organisation, cannot be assigned.
    [Fact]
    public async Task An_archived_role_or_one_of_another_organisation_is_400_choose_a_role()
    {
        var northside = await factory.AddOrganisationAsync("northside-assign");
        var foreign = factory.RoleIdOf("Volunteer", northside.Id);
        var archived = await factory.WithDbAsync(async db =>
        {
            var definition = new Domain.Organisations.RoleDefinition(Guid.NewGuid(), $"old-{Guid.NewGuid():N}"[..20], "Retired role", "", [], 400);
            definition.Archive(DateTime.UtcNow);
            db.RoleDefinitions.Add(definition);
            await db.SaveChangesAsync();
            return definition.Id;
        });
        var priya = await factory.AddMemberAsync("Priya Shah", p => p.AddRole(Role.SystemAdmin, Granter, DateTime.UtcNow));
        var ruth = await factory.AddMemberAsync("Ruth Alvarez");
        var client = factory.ClientFor(priya, Role.SystemAdmin);

        foreach (var id in new[] { foreign, archived })
        {
            var response = await client.PostAsJsonAsync($"/api/profiles/{ruth.ProfileId}/roles", new { RoleId = id });

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Contains("Choose a role.", await response.Content.ReadAsStringAsync());
        }

        Assert.Empty((await LoadAsync(ruth.ProfileId)).Roles);
    }

    [Fact]
    public async Task Unknown_role_is_400_and_unknown_profile_is_404_to_a_city_lead_and_403_to_a_member()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var ruth = await factory.AddMemberAsync("Ruth Alvarez");
        var unknown = $"/api/profiles/{Guid.NewGuid()}/roles";

        var badRole = await factory.ClientFor(grace, Role.CityLead).PostAsJsonAsync($"/api/profiles/{ruth.ProfileId}/roles", new { RoleId = Guid.NewGuid() });
        var asLead = await factory.ClientFor(grace, Role.CityLead).PostAsJsonAsync(unknown, new { RoleId = factory.RoleIdOf("Volunteer") });
        var asMember = await factory.ClientFor(ruth).PostAsJsonAsync(unknown, new { RoleId = factory.RoleIdOf("Volunteer") });

        Assert.Equal(HttpStatusCode.BadRequest, badRole.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, asLead.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, asMember.StatusCode);
    }

    private Task<Profile> LoadAsync(Guid id) =>
        factory.WithDbAsync(db => db.Profiles.AsNoTracking().SingleAsync(p => p.Id == id));

    private Task<string> EmailOfAsync(ProfileClients.Member member) =>
        factory.WithDbAsync(db => db.Users.Where(u => u.Id == member.UserId).Select(u => u.Email!).SingleAsync());
}
