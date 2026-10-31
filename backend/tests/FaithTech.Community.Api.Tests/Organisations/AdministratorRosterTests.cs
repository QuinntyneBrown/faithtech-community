// Traces to: L2-139 AC2
using System.Net;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Organisations;

// Each organisation has its own administrator roster, so a lease taken in one never holds up another (L2-139 AC2).
public class AdministratorRosterTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    [Fact]
    public async Task A_lease_held_in_one_organisation_does_not_block_an_administrator_change_in_another()
    {
        var northside = await factory.AddOrganisationAsync("northside-roster");
        var ana = await factory.AddMemberAsync(northside, "Ana Lima", Role.SystemAdmin);
        var ben = await factory.AddMemberAsync(northside, "Ben Cole", Role.SystemAdmin);
        // FaithTech's roster is leased by a removal still in flight.
        await factory.WithDbAsync(async db =>
        {
            var roster = await db.OrganisationAdminRosters.SingleAsync();
            roster.TryTake(Guid.NewGuid(), factory.Time.GetUtcNow());
            return await db.SaveChangesAsync();
        });

        var response = await factory.ClientOn(northside, ana).DeleteAsync($"/api/profiles/{ben.ProfileId}/roles/SystemAdmin");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
