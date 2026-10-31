// Traces to: L2-136 AC4, AC5; L2-137 AC1, AC2, AC3; L2-139 AC1; L2-152 AC1
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Announcements;
using FaithTech.Community.Domain.Notes;
using FaithTech.Community.Domain.Organisations;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Organisations;

// "Who may grant" saves a role's grant rules; Archive retires a role nothing uses.
public class GrantRulesAndArchiveTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    public sealed record Definition(Guid Id, string Name, Guid[] GrantableRoleIds, bool Archived);

    public sealed record Me(Guid[] GrantableRoleIds);

    public sealed record OrganisationRoles(OrganisationRole[] Roles);

    public sealed record OrganisationRole(Guid Id, string Name);

    private HttpClient RolesManager() =>
        factory.ClientWithCapabilities(factory.AddMemberAsync("Ruth Alvarez").GetAwaiter().GetResult(), Capability.ManageRoles);

    private async Task<Guid> DefineAsync(HttpClient manager, string name, params string[] capabilities)
    {
        var response = await manager.PostAsJsonAsync("/api/organisation/roles", new { Name = name, Description = "", Capabilities = capabilities });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<Definition>())!.Id;
    }

    private Task GiveAsync(ProfileClients.Member member, Guid role) =>
        factory.WithDbAsync(async db =>
        {
            var profile = await db.Profiles.SingleAsync(p => p.Id == member.ProfileId);
            profile.AddRole(await db.RoleDefinitions.SingleAsync(d => d.Id == role), Guid.Empty, DateTime.UtcNow);
            return await db.SaveChangesAsync();
        });

    private static string Unique(string name) => $"{name} {Guid.NewGuid():N}"[..(name.Length + 7)];

    // L2-137 AC1, L2-152 AC1: the rules take effect on a holder's next request and are audited.
    [Fact]
    public async Task Saved_rules_change_what_a_grantor_may_grant_and_are_audited()
    {
        var manager = RolesManager();
        var grantor = await DefineAsync(manager, Unique("Coordinator"), Capability.AssignRoles);
        var helper = await DefineAsync(manager, Unique("Helper"));
        var coordinator = await factory.AddMemberAsync("Cora Coordinator");
        await GiveAsync(coordinator, grantor);
        var client = factory.ClientFor(coordinator);
        Assert.DoesNotContain(helper, (await client.GetFromJsonAsync<Me>("/api/me"))!.GrantableRoleIds);

        var response = await manager.PutAsJsonAsync($"/api/organisation/roles/{grantor}/grants", new { GrantableRoleIds = new[] { helper } });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal([helper], (await response.Content.ReadFromJsonAsync<Definition>())!.GrantableRoleIds);
        Assert.Equal([helper], (await client.GetFromJsonAsync<Me>("/api/me"))!.GrantableRoleIds);
        var list = await manager.GetFromJsonAsync<Definition[]>("/api/organisation/roles");
        Assert.Equal([helper], Assert.Single(list!, d => d.Id == grantor).GrantableRoleIds);
        var entry = await factory.WithDbAsync(db => db.AuditEntries.SingleAsync(a => a.Action == "role.grants.updated" && a.TargetId == grantor.ToString()));
        Assert.Contains(helper.ToString(), entry.AfterJson);
    }

    // L2-137 AC2: stored but inactive until the grantor carries AssignRoles.
    [Fact]
    public async Task Rules_for_a_grantor_without_AssignRoles_are_stored_but_grant_nothing()
    {
        var manager = RolesManager();
        var grantor = await DefineAsync(manager, Unique("Observer"), Capability.ViewReports);
        var helper = await DefineAsync(manager, Unique("Helper"));
        var observer = await factory.AddMemberAsync("Obi Observer");
        await GiveAsync(observer, grantor);

        var response = await manager.PutAsJsonAsync($"/api/organisation/roles/{grantor}/grants", new { GrantableRoleIds = new[] { helper } });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Empty((await factory.ClientFor(observer).GetFromJsonAsync<Me>("/api/me"))!.GrantableRoleIds);
        await manager.PutAsJsonAsync($"/api/organisation/roles/{grantor}", new { Name = Unique("Observer"), Description = "", Capabilities = new[] { Capability.AssignRoles } });
        Assert.Equal([helper], (await factory.ClientFor(observer).GetFromJsonAsync<Me>("/api/me"))!.GrantableRoleIds);
    }

    // L2-137 AC3.
    [Fact]
    public async Task An_administration_role_under_a_grantor_that_is_not_one_is_400()
    {
        var manager = RolesManager();
        var grantor = await DefineAsync(manager, Unique("Coordinator"), Capability.AssignRoles);
        var systemAdmin = factory.RoleIdOf("SystemAdmin");

        var response = await manager.PutAsJsonAsync($"/api/organisation/roles/{grantor}/grants", new { GrantableRoleIds = new[] { systemAdmin } });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>();
        Assert.Equal("Only administrators can grant administration. Untick System Admin to save.", Assert.Single(problem!.Errors["GrantableRoleIds"]));
    }

    [Fact]
    public async Task A_role_of_another_organisation_or_an_archived_one_is_400()
    {
        var organisation = await factory.AddOrganisationAsync($"gr-{Guid.NewGuid():N}"[..10]);
        var theirs = await factory.WithDbAsync(organisation.Id, db => db.RoleDefinitions.Select(d => d.Id).FirstAsync());
        var manager = RolesManager();
        var grantor = await DefineAsync(manager, Unique("Coordinator"), Capability.AssignRoles);

        var response = await manager.PutAsJsonAsync($"/api/organisation/roles/{grantor}/grants", new { GrantableRoleIds = new[] { theirs } });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Anyone_without_ManageRoles_gets_403_from_grants_and_archive()
    {
        var member = factory.ClientWithCapabilities(await factory.AddMemberAsync("Leah Thompson"), Capability.ManageOrganisationSettings);
        var volunteer = factory.RoleIdOf("Volunteer");

        Assert.Equal(HttpStatusCode.Forbidden, (await member.PutAsJsonAsync($"/api/organisation/roles/{volunteer}/grants", new { GrantableRoleIds = Array.Empty<Guid>() })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await member.PostAsync($"/api/organisation/roles/{volunteer}/archive", null)).StatusCode);
    }

    // L2-136 AC4: unused, it leaves every picker and is audited.
    [Fact]
    public async Task An_unused_role_is_archived_and_leaves_every_picker()
    {
        var manager = RolesManager();
        var mentor = await DefineAsync(manager, Unique("Mentor"));

        var response = await manager.PostAsync($"/api/organisation/roles/{mentor}/archive", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var organisation = await factory.ClientFor(await factory.AddMemberAsync("Anyone")).GetFromJsonAsync<OrganisationRoles>("/api/organisation");
        Assert.DoesNotContain(organisation!.Roles, r => r.Id == mentor);
        Assert.Contains((await manager.GetFromJsonAsync<Definition[]>("/api/organisation/roles?archived=true"))!, d => d.Id == mentor);
        Assert.True(await factory.WithDbAsync(db => db.AuditEntries.AnyAsync(a => a.Action == "role.archived" && a.TargetId == mentor.ToString())));
    }

    [Fact]
    public async Task A_held_role_is_409_with_the_count()
    {
        var manager = RolesManager();
        var role = await DefineAsync(manager, Unique("Greeter"));
        await GiveAsync(await factory.AddMemberAsync("One"), role);
        await GiveAsync(await factory.AddMemberAsync("Two"), role);

        var response = await manager.PostAsync($"/api/organisation/roles/{role}/archive", null);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("2 members hold this role. Remove it from them first.", (await response.Content.ReadFromJsonAsync<ProblemDetails>())!.Detail);
    }

    [Fact]
    public async Task A_role_a_grant_rule_or_an_audience_names_is_409_naming_them()
    {
        var manager = RolesManager();
        var name = Unique("Coordinator");
        var grantor = await DefineAsync(manager, name, Capability.AssignRoles);
        var builder = await DefineAsync(manager, Unique("Builder"));
        await manager.PutAsJsonAsync($"/api/organisation/roles/{grantor}/grants", new { GrantableRoleIds = new[] { builder } });
        await factory.WithDbAsync(async db =>
        {
            db.Announcements.Add(new Announcement("Hackathon builders", "See you there.", AnnouncementAudience.ForRoles(builder), Guid.NewGuid(), DateTimeOffset.UtcNow, false));
            var page = new NotePage(Guid.NewGuid(), "Build night plan", null, DateTimeOffset.UtcNow);
            page.SetAudience(NoteVisibility.Shared, [], [await db.RoleDefinitions.SingleAsync(d => d.Id == builder)]);
            db.NotePages.Add(page);
            return await db.SaveChangesAsync();
        });

        var response = await manager.PostAsync($"/api/organisation/roles/{builder}/archive", null);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal(
            $"{name}’s grant rules, the page “Build night plan” and the announcement audience “Hackathon builders” still use this role. Remove it from them first.",
            (await response.Content.ReadFromJsonAsync<ProblemDetails>())!.Detail);
    }

    [Fact]
    public async Task Another_organisations_role_is_not_found()
    {
        var organisation = await factory.AddOrganisationAsync($"ar-{Guid.NewGuid():N}"[..10]);
        var theirs = await factory.WithDbAsync(organisation.Id, db => db.RoleDefinitions.Select(d => d.Id).FirstAsync());

        Assert.Equal(HttpStatusCode.NotFound, (await RolesManager().PostAsync($"/api/organisation/roles/{theirs}/archive", null)).StatusCode);
    }
}
