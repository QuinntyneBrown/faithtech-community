using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Organisations;

// Traces to: L2-133 AC1. /api/me names the host's organisation and lists the account's other active, unsuspended
// memberships by organisation name and host, for the switcher.
public class MeTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    public sealed record Membership(string Name, string Host);

    public sealed record MeOrganisation(string Slug, string Name, string ShortName, string Host);

    public sealed record Me(Guid ProfileId, string Name, MeOrganisation Organisation, Membership[] Memberships);

    [Fact]
    public async Task A_member_of_one_organisation_has_no_other_memberships()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");

        var me = await factory.ClientFor(grace).GetFromJsonAsync<Me>("/api/me");

        Assert.Equal(grace.ProfileId, me!.ProfileId);
        Assert.Equal("faithtech", me.Organisation.Slug);
        Assert.Empty(me.Memberships);
    }

    [Fact]
    public async Task Other_memberships_are_listed_by_name_and_host()
    {
        var northside = await factory.AddOrganisationAsync("northside");
        var southgate = await factory.AddOrganisationAsync("southgate");
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        await factory.AddMembershipAsync(northside, grace.UserId, "Grace O.");
        await factory.AddMembershipAsync(southgate, grace.UserId, "Grace O.");

        var me = await factory.ClientFor(grace).GetFromJsonAsync<Me>("/api/me");

        Assert.Equal(
            [new Membership("northside community", "app.northside.test"), new Membership("southgate community", "app.southgate.test")],
            me!.Memberships.OrderBy(m => m.Host));
    }

    [Fact]
    public async Task A_suspended_membership_is_not_offered()
    {
        var northside = await factory.AddOrganisationAsync("northside");
        var southgate = await factory.AddOrganisationAsync("southgate");
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        await factory.AddMembershipAsync(northside, grace.UserId, "Grace O.");
        var suspended = await factory.AddMembershipAsync(southgate, grace.UserId, "Grace O.");
        await factory.WithDbAsync(southgate.Id, async db =>
        {
            (await db.Profiles.SingleAsync(p => p.Id == suspended.ProfileId)).Suspend("Spam", DateTime.UtcNow);
            return await db.SaveChangesAsync();
        });

        var me = await factory.ClientFor(grace).GetFromJsonAsync<Me>("/api/me");

        Assert.Equal([new Membership("northside community", "app.northside.test")], me!.Memberships);
    }
}
