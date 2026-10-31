using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Organisations.Isolation;

// Traces to: L2-130 AC1 to AC3.
public class ProfileIsolationTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    [Fact]
    public async Task A_profile_of_another_organisation_is_not_found_and_never_listed()
    {
        var northside = await factory.AddOrganisationAsync();
        var marker = Isolation.Marker();
        var other = await factory.AddMemberAsync(northside, marker, Role.Volunteer);
        var faithTech = factory.ClientFor(await factory.AddMemberAsync("Priya Shah"), Role.SystemAdmin, Role.Staff);

        await faithTech.AssertNotFoundAsync($"/api/profiles/{other.ProfileId}");
        await faithTech.AssertListLacksAsync("/api/team", marker);
        await faithTech.AssertListLacksAsync("/api/people", marker);
        await faithTech.AssertListLacksAsync($"/api/admin/users?q={marker}", marker);
    }

    [Fact]
    public async Task A_profile_is_stamped_with_the_organisation_it_is_created_in()
    {
        var northside = await factory.AddOrganisationAsync();

        var member = await factory.AddMemberAsync(northside, "Ana Lima");

        var organisationId = await factory.WithDbAsync(northside.Id, db =>
            db.Profiles.Where(p => p.Id == member.ProfileId).Select(p => p.OrganisationId).SingleAsync());
        Assert.Equal(northside.Id, organisationId);
    }

    [Fact]
    public async Task A_profile_of_another_organisation_cannot_be_written_from_this_one()
    {
        var northside = await factory.AddOrganisationAsync();
        var member = await factory.AddMemberAsync(northside, "Ana Lima");
        var profile = await factory.WithDbAsync(northside.Id, db => db.Profiles.AsNoTracking().SingleAsync(p => p.Id == member.ProfileId));

        await Assert.ThrowsAsync<InvalidOperationException>(() => factory.WithDbAsync(async db =>
        {
            profile.Update("Ana Lima-Souza", profile.ChapterId, profile.Bio);
            db.Profiles.Update(profile);
            return await db.SaveChangesAsync();
        }));
    }
}
