// Traces to: L2-136 AC1, AC2, AC3, AC5, AC6, AC7, AC8; L2-139 AC1, AC3, AC6; L2-147 AC2; L2-152 AC1
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Agile;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Agile;
using FaithTech.Community.Domain.Notifications;
using FaithTech.Community.Domain.Organisations;
using FaithTech.Community.Domain.Profiles;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Organisations;

// The Roles page's definitions: listed for the Organisation section, defined and edited by a holder of ManageRoles.
public class RoleDefinitionsTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    public sealed record Definition(
        Guid Id,
        string Key,
        string Name,
        string Description,
        string[] Capabilities,
        bool ShowOnTeam,
        bool ChapterScopable,
        bool IsOversight,
        int HolderCount,
        bool Archived);

    public sealed record Me(string[] Capabilities);

    private static object Command(string name, params string[] capabilities) => new
    {
        Name = name,
        Description = "Helps on the night.",
        Capabilities = capabilities,
        ShowOnTeam = true,
        IsOversight = false,
    };

    private HttpClient RolesManager(string name = "Ruth Alvarez") =>
        factory.ClientWithCapabilities(factory.AddMemberAsync(name).GetAwaiter().GetResult(), Capability.ManageRoles);

    private Task<Guid> DefinitionOfAsync(ProfileClients.Member member) =>
        factory.WithDbAsync(db => db.Profiles.Where(p => p.Id == member.ProfileId)
            .SelectMany(p => p.Roles).Select(r => r.RoleDefinitionId).SingleAsync());

    // L2-136 AC6: non-archived, in order, with the holder count, capabilities and flags.
    [Fact]
    public async Task A_roles_manager_lists_the_definitions_in_order_with_holder_counts()
    {
        var helper = await factory.AddMemberAsync("Helper One");
        factory.ClientWithCapabilities(helper, Capability.JoinWorkspaces);
        var helperRole = await DefinitionOfAsync(helper);
        var manager = RolesManager();
        var expected = await factory.WithDbAsync(db => db.RoleDefinitions
            .Where(d => d.ArchivedAtUtc == null).OrderBy(d => d.SortOrder).ThenBy(d => d.Name).Select(d => d.Name).ToListAsync());

        var list = await manager.GetFromJsonAsync<Definition[]>("/api/organisation/roles");

        Assert.Equal(expected, list!.Select(d => d.Name));
        var listed = Assert.Single(list!, d => d.Id == helperRole);
        Assert.Equal((1, false), (listed.HolderCount, listed.Archived));
        Assert.Equal([Capability.JoinWorkspaces], listed.Capabilities);
        var seeded = Assert.Single(list!, d => d.Key == "SystemAdmin");
        Assert.Contains(Capability.AdministerOrganisation, seeded.Capabilities);
    }

    [Fact]
    public async Task The_archived_filter_lists_only_archived_definitions()
    {
        var member = await factory.AddMemberAsync("Archived Holder");
        factory.ClientWithCapabilities(member, Capability.ViewReports);
        var id = await DefinitionOfAsync(member);
        await factory.WithDbAsync(async db =>
        {
            (await db.RoleDefinitions.SingleAsync(d => d.Id == id)).Archive(DateTime.UtcNow);
            return await db.SaveChangesAsync();
        });
        var manager = RolesManager();

        var archived = await manager.GetFromJsonAsync<Definition[]>("/api/organisation/roles?archived=true");
        var active = await manager.GetFromJsonAsync<Definition[]>("/api/organisation/roles");

        Assert.Contains(archived!, d => d.Id == id && d.Archived);
        Assert.All(archived!, d => Assert.True(d.Archived));
        Assert.DoesNotContain(active!, d => d.Id == id);
    }

    // L2-147 AC2: a settings manager sees the Roles tab read-only.
    [Fact]
    public async Task A_settings_manager_reads_the_list_but_cannot_change_it()
    {
        var holder = factory.ClientWithCapabilities(await factory.AddMemberAsync("Grace Okonkwo"), Capability.ManageOrganisationSettings);

        Assert.Equal(HttpStatusCode.OK, (await holder.GetAsync("/api/organisation/roles")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await holder.PostAsJsonAsync("/api/organisation/roles", Command("Greeter"))).StatusCode);
    }

    // L2-136 AC8.
    [Theory]
    [InlineData]
    [InlineData(Capability.AssignRoles)]
    [InlineData(Capability.ViewReports, Capability.ManageEvents)]
    public async Task Anyone_else_gets_403_from_every_definition_route(params string[] capabilities)
    {
        var member = factory.ClientWithCapabilities(await factory.AddMemberAsync("Leah Thompson"), capabilities);
        var volunteer = factory.RoleIdOf("Volunteer");

        Assert.Equal(HttpStatusCode.Forbidden, (await member.GetAsync("/api/organisation/roles")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await member.PostAsJsonAsync("/api/organisation/roles", Command("Greeter"))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await member.PutAsJsonAsync($"/api/organisation/roles/{volunteer}", Command("Renamed"))).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await member.GetAsync("/api/organisation")).StatusCode);
    }

    // L2-136 AC1, L2-152 AC1.
    [Fact]
    public async Task A_roles_manager_defines_a_role_that_every_picker_then_offers_and_the_audit_records()
    {
        var ruth = await factory.AddMemberAsync("Ruth Alvarez");
        var manager = factory.ClientWithCapabilities(ruth, Capability.ManageRoles);

        var response = await manager.PostAsJsonAsync("/api/organisation/roles", Command("  Door Greeter  ", Capability.ManageAttendance));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = (await response.Content.ReadFromJsonAsync<Definition>())!;
        Assert.Equal(
            ("Door Greeter", "door-greeter", "Helps on the night.", true, false, 0),
            (created.Name, created.Key, created.Description, created.ShowOnTeam, created.IsOversight, created.HolderCount));
        Assert.Equal([Capability.ManageAttendance], created.Capabilities);
        var organisation = await factory.ClientFor(await factory.AddMemberAsync("Anyone")).GetStringAsync("/api/organisation");
        Assert.Contains("Door Greeter", organisation);
        var entry = await factory.WithDbAsync(db => db.AuditEntries.SingleAsync(a => a.Action == "role.defined" && a.TargetId == created.Id.ToString()));
        Assert.Equal(("RoleDefinition", ruth.ProfileId), (entry.TargetType, entry.ActorId));
        Assert.Contains("Door Greeter", entry.AfterJson);
    }

    [Fact]
    public async Task A_new_role_whose_name_makes_a_used_key_gets_its_own()
    {
        var manager = RolesManager();
        var first = await (await manager.PostAsJsonAsync("/api/organisation/roles", Command("Key Holder"))).Content.ReadFromJsonAsync<Definition>();
        await manager.PutAsJsonAsync($"/api/organisation/roles/{first!.Id}", Command("Keys Holder"));

        var second = await (await manager.PostAsJsonAsync("/api/organisation/roles", Command("Key Holder"))).Content.ReadFromJsonAsync<Definition>();

        Assert.Equal(("key-holder", "key-holder-2"), (first.Key, second!.Key));
    }

    // L2-136 AC3.
    [Theory]
    [InlineData("", "Name", "Enter a name for the role.")]
    [InlineData("A role name that runs on far longer than the sixty characters allowed", "Name", "Use 60 characters or fewer for the name.")]
    [InlineData("volunteer", "Name", "A role called volunteer already exists. Choose another name.")]
    public async Task An_invalid_name_is_400_on_the_field_and_nothing_is_saved(string name, string field, string message)
    {
        var manager = RolesManager();
        var count = await factory.WithDbAsync(db => db.RoleDefinitions.CountAsync());

        var response = await manager.PostAsJsonAsync("/api/organisation/roles", Command(name));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>();
        Assert.Equal(message, Assert.Single(problem!.Errors[field]));
        Assert.Equal(count, await factory.WithDbAsync(db => db.RoleDefinitions.CountAsync()));
    }

    [Fact]
    public async Task A_long_description_or_an_unknown_capability_is_400()
    {
        var manager = RolesManager();

        var described = await manager.PostAsJsonAsync("/api/organisation/roles", new { Name = "Wordy", Description = new string('x', 201), Capabilities = Array.Empty<string>() });
        var unknown = await manager.PostAsJsonAsync("/api/organisation/roles", Command("Wizard", "CastSpells"));

        Assert.Equal("Use 200 characters or fewer for the description.", Assert.Single((await described.Content.ReadFromJsonAsync<ValidationProblemDetails>())!.Errors["Description"]));
        Assert.Equal("Choose capabilities from the list.", Assert.Single((await unknown.Content.ReadFromJsonAsync<ValidationProblemDetails>())!.Errors["Capabilities"]));
    }

    // L2-136 AC7.
    [Fact]
    public async Task Only_an_administrator_can_add_AdministerOrganisation()
    {
        var volunteer = factory.RoleIdOf("Volunteer");
        var manager = RolesManager();
        var admin = factory.ClientFor(await factory.AddMemberAsync("Priya Shah"), Role.SystemAdmin);

        var defined = await manager.PostAsJsonAsync("/api/organisation/roles", Command("Deputy", Capability.AdministerOrganisation));
        var edited = await manager.PutAsJsonAsync($"/api/organisation/roles/{volunteer}", Command("Volunteer", Capability.AdministerOrganisation));
        var byAdmin = await admin.PostAsJsonAsync("/api/organisation/roles", Command("Co-administrator", Capability.AdministerOrganisation));

        Assert.Equal(HttpStatusCode.Forbidden, defined.StatusCode);
        Assert.Equal("Only an administrator can grant administration.", (await defined.Content.ReadFromJsonAsync<ProblemDetails>())!.Detail);
        Assert.Equal(HttpStatusCode.Forbidden, edited.StatusCode);
        Assert.Equal(HttpStatusCode.Created, byAdmin.StatusCode);
    }

    // L2-136 AC2, L2-133 AC5, L2-152 AC1.
    [Fact]
    public async Task An_edit_reaches_every_holder_on_their_next_request_and_is_audited()
    {
        var ruth = await factory.AddMemberAsync("Ruth Alvarez");
        var manager = factory.ClientWithCapabilities(ruth, Capability.ManageRoles);
        var created = await (await manager.PostAsJsonAsync("/api/organisation/roles", Command("Usher", Capability.ViewAttendees))).Content.ReadFromJsonAsync<Definition>();
        var holder = await factory.AddMemberAsync("Sam Usher");
        await factory.WithDbAsync(async db =>
        {
            var profile = await db.Profiles.SingleAsync(p => p.Id == holder.ProfileId);
            profile.AddRole(await db.RoleDefinitions.SingleAsync(d => d.Id == created!.Id), Guid.Empty, DateTime.UtcNow);
            return await db.SaveChangesAsync();
        });
        var holderClient = factory.ClientFor(holder);
        Assert.Contains(Capability.ViewAttendees, (await holderClient.GetFromJsonAsync<Me>("/api/me"))!.Capabilities);

        var response = await manager.PutAsJsonAsync($"/api/organisation/roles/{created!.Id}", new
        {
            Name = "Lead Usher",
            Description = "Runs the door.",
            Capabilities = new[] { Capability.ManageAttendance },
            ShowOnTeam = false,
            IsOversight = true,
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var updated = (await response.Content.ReadFromJsonAsync<Definition>())!;
        Assert.Equal(("Lead Usher", "usher", false, true, 1), (updated.Name, updated.Key, updated.ShowOnTeam, updated.IsOversight, updated.HolderCount));
        var capabilities = (await holderClient.GetFromJsonAsync<Me>("/api/me"))!.Capabilities;
        Assert.Contains(Capability.ManageAttendance, capabilities);
        Assert.DoesNotContain(Capability.ViewAttendees, capabilities);
        var entry = await factory.WithDbAsync(db => db.AuditEntries.SingleAsync(a => a.Action == "role.updated" && a.TargetId == created.Id.ToString()));
        Assert.Equal(ruth.ProfileId, entry.ActorId);
        Assert.Contains("\"Name\":\"Usher\"", entry.BeforeJson);
        Assert.Contains("\"Name\":\"Lead Usher\"", entry.AfterJson);
    }

    // L2-136 AC1: "Can be held for a {chapter}" is saved on define and on edit.
    [Fact]
    public async Task The_chapter_switch_is_saved_on_define_and_edit()
    {
        var manager = RolesManager();

        var created = await (await manager.PostAsJsonAsync("/api/organisation/roles", new
        {
            Name = "Meet-up Lead", Description = "", Capabilities = new[] { Capability.ManageEvents },
            ShowOnTeam = true, ChapterScopable = true, IsOversight = false,
        })).Content.ReadFromJsonAsync<Definition>();
        var edited = await (await manager.PutAsJsonAsync($"/api/organisation/roles/{created!.Id}", new
        {
            Name = "Meet-up Lead", Description = "", Capabilities = new[] { Capability.ManageEvents },
            ShowOnTeam = true, ChapterScopable = false, IsOversight = false,
        })).Content.ReadFromJsonAsync<Definition>();

        Assert.True(created.ChapterScopable);
        Assert.False(edited!.ChapterScopable);
    }

    [Fact]
    public async Task Renaming_onto_another_roles_name_is_400_but_keeping_its_own_is_fine()
    {
        var manager = RolesManager();
        var created = await (await manager.PostAsJsonAsync("/api/organisation/roles", Command("Steward"))).Content.ReadFromJsonAsync<Definition>();

        var clash = await manager.PutAsJsonAsync($"/api/organisation/roles/{created!.Id}", Command("City Lead"));
        var same = await manager.PutAsJsonAsync($"/api/organisation/roles/{created.Id}", Command("STEWARD"));

        Assert.Equal(HttpStatusCode.BadRequest, clash.StatusCode);
        Assert.Equal(HttpStatusCode.OK, same.StatusCode);
    }

    // L2-139 AC3, AC6: a removed capability no other role gives raises CapabilityLost for each holder.
    [Fact]
    public async Task Dropping_OwnWorkspaces_from_an_owners_role_tells_the_administrators()
    {
        var admin = await factory.AddMemberAsync("Priya Admin");
        factory.ClientFor(admin, Role.SystemAdmin);
        var owner = await factory.AddMemberAsync("Olu Owner");
        factory.ClientWithCapabilities(owner, Capability.OwnWorkspaces);
        var role = await DefinitionOfAsync(owner);
        await factory.AddWorkspaceAsync(owner, "Lagos builders", WorkspaceMethod.Kanban);

        var response = await RolesManager().PutAsJsonAsync($"/api/organisation/roles/{role}", Command("Former owners", Capability.JoinWorkspaces));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True(await factory.WithDbAsync(db => db.Notifications.AnyAsync(n =>
            n.RecipientId == admin.ProfileId && n.Kind == NotificationKind.WorkspaceOwnerLostCapability && n.Title.Contains("Lagos builders"))));
    }

    // L2-136 AC5, L2-139 AC1.
    [Fact]
    public async Task Dropping_AdministerOrganisation_from_the_last_administrators_role_is_409()
    {
        var organisation = await factory.AddOrganisationAsync($"solo-{Guid.NewGuid():N}"[..12]);
        var admin = await factory.AddMemberAsync(organisation, "Only Admin", Role.SystemAdmin);
        var client = factory.ClientOn(organisation, admin);
        var adminRole = await factory.WithDbAsync(organisation.Id, db => db.RoleDefinitions.Where(d => d.Key == "SystemAdmin").Select(d => d.Id).SingleAsync());

        var response = await client.PutAsJsonAsync($"/api/organisation/roles/{adminRole}", Command("System Admin", Capability.ManageRoles));

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("There must always be at least one administrator.", (await response.Content.ReadFromJsonAsync<ProblemDetails>())!.Detail);
        Assert.Contains(Capability.AdministerOrganisation, await factory.WithDbAsync(organisation.Id, db => db.RoleDefinitions.Where(d => d.Id == adminRole).Select(d => d.Capabilities).SingleAsync()));
    }

    [Fact]
    public async Task Dropping_it_is_allowed_while_another_role_keeps_an_administrator()
    {
        var organisation = await factory.AddOrganisationAsync($"pair-{Guid.NewGuid():N}"[..12]);
        var admin = await factory.AddMemberAsync(organisation, "First Admin", Role.SystemAdmin);
        var client = factory.ClientOn(organisation, admin);
        var created = await (await client.PostAsJsonAsync("/api/organisation/roles", Command("Co-admin", Capability.AdministerOrganisation))).Content.ReadFromJsonAsync<Definition>();
        var second = await factory.AddMemberAsync(organisation, "Second Admin");
        await factory.WithDbAsync(organisation.Id, async db =>
        {
            var profile = await db.Profiles.SingleAsync(p => p.Id == second.ProfileId);
            profile.AddRole(await db.RoleDefinitions.SingleAsync(d => d.Id == created!.Id), Guid.Empty, DateTime.UtcNow);
            return await db.SaveChangesAsync();
        });
        var adminRole = await factory.WithDbAsync(organisation.Id, db => db.RoleDefinitions.Where(d => d.Key == "SystemAdmin").Select(d => d.Id).SingleAsync());

        var response = await client.PutAsJsonAsync($"/api/organisation/roles/{adminRole}", Command("System Admin", Capability.ManageRoles));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    // ADR 0032: another organisation's definitions are neither listed nor editable.
    [Fact]
    public async Task Another_organisations_definitions_are_not_found()
    {
        var organisation = await factory.AddOrganisationAsync($"iso-{Guid.NewGuid():N}"[..12]);
        var theirs = await factory.WithDbAsync(organisation.Id, db => db.RoleDefinitions.Select(d => d.Id).FirstAsync());
        var manager = RolesManager();

        var list = await manager.GetFromJsonAsync<Definition[]>("/api/organisation/roles");
        var edit = await manager.PutAsJsonAsync($"/api/organisation/roles/{theirs}", Command("Taken over"));

        Assert.DoesNotContain(list!, d => d.Id == theirs);
        Assert.Equal(HttpStatusCode.NotFound, edit.StatusCode);
    }
}
