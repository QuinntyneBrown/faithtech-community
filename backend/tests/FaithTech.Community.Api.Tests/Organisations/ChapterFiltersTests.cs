// Traces to: L2-142 AC1, AC2, AC3
using System.Net.Http.Json;
using System.Text.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Profiles;

namespace FaithTech.Community.Api.Tests.Organisations;

/// <summary>The team, events, People and Reports filter by a chapter's id, and ignore it while chapters are off.</summary>
public class ChapterFiltersTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    // L2-142 AC2: only members tagged with the chapter are listed, and each row names its chapter.
    [Fact]
    public async Task The_team_filters_by_chapter_id()
    {
        var toronto = await factory.AddChapterAsync($"Toronto {Guid.NewGuid():N}"[..14]);
        var austin = await factory.AddChapterAsync($"Austin {Guid.NewGuid():N}"[..14]);
        var grace = await TeamMemberAsync("Grace Okonkwo", toronto.Id);
        var marcus = await TeamMemberAsync("Marcus Lee", austin.Id);
        var viewer = factory.ClientFor(await factory.AddMemberAsync("Leah Thompson"));

        var list = await viewer.GetFromJsonAsync<JsonElement>($"/api/team?chapter={toronto.Id}&pageSize=100");

        var members = list.GetProperty("members").EnumerateArray().ToList();
        var row = Assert.Single(members, m => m.GetProperty("profileId").GetGuid() == grace.ProfileId);
        Assert.Equal(toronto.Name, row.GetProperty("chapterName").GetString());
        Assert.DoesNotContain(members, m => m.GetProperty("profileId").GetGuid() == marcus.ProfileId);
        Assert.All(members, m => Assert.Equal(toronto.Name, m.GetProperty("chapterName").GetString()));
        Assert.False(list.TryGetProperty("cities", out _));
    }

    // L2-142 AC3: with chapters off the filter is ignored and the list is organisation-wide.
    [Fact]
    public async Task With_chapters_off_the_team_ignores_the_chapter_filter()
    {
        var (client, organisation, downtown) = await CampusesAsync();
        var other = await factory.AddMemberAsync(organisation, "Ruth Alvarez", Role.CityLead);
        await TurnChaptersOffAsync(client);

        var list = await client.GetFromJsonAsync<JsonElement>($"/api/team?chapter={downtown}&pageSize=100");

        Assert.Contains(list.GetProperty("members").EnumerateArray(), m => m.GetProperty("profileId").GetGuid() == other.ProfileId);
    }

    private async Task<ProfileClients.Member> TeamMemberAsync(string name, Guid chapterId) =>
        await factory.AddMemberAsync(name, p =>
        {
            p.Update(name, chapterId, null);
            p.AddRole(Role.CityLead, Guid.Empty, DateTime.UtcNow);
        });

    /// <summary>A new organisation with campuses on, an admin tagged with the Downtown campus, and their client.</summary>
    private async Task<(HttpClient Client, OrganisationScopes.OtherOrganisation Organisation, Guid Downtown)> CampusesAsync()
    {
        var organisation = await factory.AddOrganisationAsync($"cf-{Guid.NewGuid():N}"[..10]);
        var admin = await factory.AddMemberAsync(organisation, "Grace Okonkwo", Role.SystemAdmin, Role.CityLead);
        var client = factory.ClientOn(organisation, admin);
        (await client.PutAsJsonAsync("/api/organisation", new { Name = "Northside", ShortName = "Northside", ChapterLabel = new { Singular = "Campus", Plural = "Campuses" } }))
            .EnsureSuccessStatusCode();
        var downtown = (await (await client.PostAsJsonAsync("/api/organisation/chapters", new { Name = "Downtown" })).Content.ReadFromJsonAsync<JsonElement>())
            .GetProperty("id").GetGuid();
        (await client.PutAsJsonAsync($"/api/profiles/{admin.ProfileId}", new { Name = "Grace Okonkwo", ChapterId = downtown })).EnsureSuccessStatusCode();
        return (client, organisation, downtown);
    }

    private static async Task TurnChaptersOffAsync(HttpClient client) =>
        (await client.PutAsJsonAsync("/api/organisation", new { Name = "Northside", ShortName = "Northside", ChapterLabel = (object?)null }))
            .EnsureSuccessStatusCode();
}
