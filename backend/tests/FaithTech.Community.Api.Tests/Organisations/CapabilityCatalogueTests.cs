using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Profiles;

namespace FaithTech.Community.Api.Tests.Organisations;

// Traces to: L2-135 AC1. The platform's capability catalogue, the same for every organisation, readable by any member.
public class CapabilityCatalogueTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    public sealed record CapabilityDto(string Key, string Description);

    [Fact]
    public async Task Any_member_reads_exactly_the_nineteen_capabilities_each_with_a_description()
    {
        var member = await factory.AddMemberAsync("Grace Okonkwo");

        var catalogue = await factory.ClientFor(member).GetFromJsonAsync<CapabilityDto[]>("/api/organisation/capabilities");

        Assert.Equal(
            [
                "ManageEvents", "ViewAttendees", "ManageAttendance", "KeepContacts", "ViewPartners", "ManagePartners",
                "InviteMembers", "ConnectLink", "OwnWorkspaces", "JoinWorkspaces", "ReadAllWorkspaces",
                "ViewPeopleDirectory", "AssignRoles", "SendAnnouncements", "AddResources", "ViewReports", "ManageRoles",
                "ManageOrganisationSettings", "AdministerOrganisation",
            ],
            catalogue!.Select(c => c.Key));
        Assert.All(catalogue!, c => Assert.False(string.IsNullOrWhiteSpace(c.Description)));
    }

    [Fact]
    public async Task Another_organisation_reads_the_same_catalogue()
    {
        var northside = await factory.AddOrganisationAsync("northside");
        var faithtech = await factory.ClientFor(await factory.AddMemberAsync("Grace Okonkwo"))
            .GetFromJsonAsync<CapabilityDto[]>("/api/organisation/capabilities");
        var other = await factory.ClientOn(northside, await factory.AddMemberAsync(northside, "Sam Lee"))
            .GetFromJsonAsync<CapabilityDto[]>("/api/organisation/capabilities");

        Assert.Equal(faithtech, other);
    }

    [Fact]
    public async Task An_anonymous_visitor_is_refused()
    {
        var response = await factory.CreateClient().GetAsync("/api/organisation/capabilities");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
