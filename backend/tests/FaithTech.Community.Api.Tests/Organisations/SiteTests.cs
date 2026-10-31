using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Profiles;

namespace FaithTech.Community.Api.Tests.Organisations;

// Traces to: L2-133 AC1, L2-134 AC1. Pages that render before sign-in read the organisation's name from GET /api/site;
// signed-in pages read it from the organisation part of /api/me. Both come from the host's organisation.
public class SiteTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    public sealed record ChapterLabel(string Singular, string Plural);

    public sealed record Site(string Name, string ShortName, ChapterLabel? ChapterLabel, string CommunityOrigin);

    public sealed record MeOrganisation(string Slug, string Name, string ShortName, string Host, ChapterLabel? ChapterLabel);

    public sealed record Me(MeOrganisation Organisation);

    [Fact]
    public async Task An_anonymous_visitor_on_faithtech_reads_its_name_and_chapter_label()
    {
        var response = await factory.CreateClient().GetAsync("/api/site");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(
            new Site("FaithTech Community", "FaithTech", new ChapterLabel("City", "Cities"), CommunityApiFactory.WebAppOrigin),
            await response.Content.ReadFromJsonAsync<Site>());
    }

    [Fact]
    public async Task An_anonymous_visitor_on_another_host_reads_that_organisations_name()
    {
        var northside = await factory.AddOrganisationAsync();
        var client = factory.CreateClient();
        client.BaseAddress = new Uri(northside.Origin);

        var site = await client.GetFromJsonAsync<Site>("/api/site");

        Assert.Equal(new Site("northside community", "northside", null, northside.Origin), site);
    }

    [Fact]
    public async Task The_marketing_host_reads_its_organisations_name_and_community_origin()
    {
        var client = factory.CreateClient();
        client.BaseAddress = new Uri(CommunityApiFactory.MarketingOrigin);

        var site = await client.GetFromJsonAsync<Site>("/api/site");

        Assert.Equal(("FaithTech", CommunityApiFactory.WebAppOrigin), (site!.ShortName, site.CommunityOrigin));
    }

    [Fact]
    public async Task A_signed_in_member_reads_their_organisation_from_me()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");

        var me = await factory.ClientFor(grace).GetFromJsonAsync<Me>("/api/me");

        Assert.Equal(
            new MeOrganisation("faithtech", "FaithTech Community", "FaithTech", "app.faithtech.test", new ChapterLabel("City", "Cities")),
            me!.Organisation);
    }

    [Fact]
    public async Task A_member_of_another_organisation_reads_that_organisation_from_me()
    {
        var northside = await factory.AddOrganisationAsync();
        var ana = await factory.AddMemberAsync(northside, "Ana Lima");

        var me = await factory.ClientOn(northside, ana).GetFromJsonAsync<Me>("/api/me");

        Assert.Equal(new MeOrganisation("northside", "northside community", "northside", "app.northside.test", null), me!.Organisation);
    }
}
