// Traces to: L2-136 AC8
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Organisations;
using FaithTech.Community.Domain.Profiles;

namespace FaithTech.Community.Api.Tests.Organisations;

// Every member reads the organisation's name and its roles that are not archived, for the role pickers.
public class GetOrganisationTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    public sealed record RoleDto(Guid Id, string Name, string Description, bool ChapterScopable);

    public sealed record OrganisationDto(string Name, string ShortName, RoleDto[] Roles);

    [Fact]
    public async Task A_member_with_no_role_reads_the_name_and_the_roles_in_order()
    {
        var ruth = await factory.AddMemberAsync("Ruth Alvarez");

        var organisation = await factory.ClientFor(ruth).GetFromJsonAsync<OrganisationDto>("/api/organisation");

        Assert.Equal(("FaithTech Community", "FaithTech"), (organisation!.Name, organisation.ShortName));
        Assert.Equal(
            ["City Lead", "Event Lead", "Create Lead", "Communications Lead", "Staff", "Volunteer", "Product Engineer", "Attendee", "System Admin"],
            organisation.Roles.Select(r => r.Name).Where(n => !n.StartsWith("Test ", StringComparison.Ordinal)));
        Assert.Equal(factory.RoleIdOf(Role.CityLead), organisation.Roles[0].Id);
    }

    [Fact]
    public async Task An_archived_role_and_another_organisations_roles_are_not_listed()
    {
        var northside = await factory.AddOrganisationAsync("northside-get");
        await factory.WithDbAsync(northside.Id, async db =>
        {
            db.RoleDefinitions.Add(new RoleDefinition(Guid.NewGuid(), "Steward", "Northside Steward", "", [], 50));
            return await db.SaveChangesAsync();
        });
        await factory.WithDbAsync(async db =>
        {
            var retired = new RoleDefinition(Guid.NewGuid(), "Retired", "Test Retired", "", [], 60);
            retired.Archive(DateTime.UtcNow);
            db.RoleDefinitions.Add(retired);
            return await db.SaveChangesAsync();
        });
        var ruth = await factory.AddMemberAsync("Ruth Alvarez");

        var organisation = await factory.ClientFor(ruth).GetFromJsonAsync<OrganisationDto>("/api/organisation");

        Assert.DoesNotContain(organisation!.Roles, r => r.Name is "Northside Steward" or "Test Retired");
    }
}
