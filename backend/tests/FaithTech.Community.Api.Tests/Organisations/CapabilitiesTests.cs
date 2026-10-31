using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Organisations;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Organisations;

// Traces to: L2-135 AC2, L2-133 AC1. The caller's capabilities are computed on every request from the non-archived
// definitions their profile holds in the host's organisation, and /api/me returns them.
public class CapabilitiesTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    public sealed record HeldRole(Guid Id, string Key, string Name, Guid? ChapterId, bool IsOversight);

    public sealed record Me(HeldRole[] Roles, string[] Capabilities);

    [Fact]
    public async Task A_member_with_no_role_has_no_capability()
    {
        var member = await factory.AddMemberAsync("Grace Okonkwo");

        var me = await factory.ClientFor(member).GetFromJsonAsync<Me>("/api/me");

        Assert.Empty(me!.Capabilities);
    }

    [Fact]
    public async Task A_member_holds_the_union_of_their_roles_capabilities()
    {
        var member = await factory.AddMemberAsync("Grace Okonkwo");

        var me = await factory.ClientFor(member, Role.Volunteer, Role.Staff).GetFromJsonAsync<Me>("/api/me");

        // L2-133 AC1: roles are the held assignments, named by the organisation, in display order.
        Assert.Equal(
            [new HeldRole(TestRoles.DefinitionId(Role.Staff), "Staff", "Staff", null, true),
             new HeldRole(TestRoles.DefinitionId(Role.Volunteer), "Volunteer", "Volunteer", null, false)],
            me!.Roles);
        Assert.Equal(
            ["AddResources", "JoinWorkspaces", "ReadAllWorkspaces", "ViewAttendees", "ViewPartners", "ViewPeopleDirectory", "ViewReports"],
            me.Capabilities.Order(StringComparer.Ordinal));
    }

    [Fact]
    public async Task An_archived_role_gives_nothing()
    {
        var northside = await factory.AddOrganisationAsync("northside-archive");
        var member = await factory.AddMemberAsync(northside, "Sam Lee", Role.Volunteer, Role.Staff);
        await ChangeDefinitionAsync(northside, "Staff", d => d.Archive(DateTime.UtcNow));

        var me = await factory.ClientOn(northside, member).GetFromJsonAsync<Me>("/api/me");

        Assert.Equal(["JoinWorkspaces"], me!.Capabilities);
    }

    [Fact]
    public async Task An_edit_to_a_held_role_is_live_on_the_next_request()
    {
        var northside = await factory.AddOrganisationAsync("northside-edit");
        var member = await factory.AddMemberAsync(northside, "Sam Lee", Role.Volunteer);
        var client = factory.ClientOn(northside, member);
        Assert.Equal(["JoinWorkspaces"], (await client.GetFromJsonAsync<Me>("/api/me"))!.Capabilities);

        await ChangeDefinitionAsync(northside, "Volunteer", d => d.SetCapabilities([Capability.JoinWorkspaces, Capability.InviteMembers]));

        Assert.Equal(
            ["InviteMembers", "JoinWorkspaces"],
            (await client.GetFromJsonAsync<Me>("/api/me"))!.Capabilities.Order(StringComparer.Ordinal));
    }

    private Task ChangeDefinitionAsync(OrganisationScopes.OtherOrganisation organisation, string key, Action<RoleDefinition> change) =>
        factory.WithDbAsync(organisation.Id, async db =>
        {
            change(await db.RoleDefinitions.SingleAsync(d => d.Key == key));
            return await db.SaveChangesAsync();
        });
}
