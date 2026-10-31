// Traces to: L2-142 AC1, AC2, AC3
using System.Net.Http.Json;
using System.Text.Json;
using FaithTech.Community.Api.Tests.Events;
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

    // L2-142 AC2: a chapter lists only its events; "none" lists only the organisation-wide ones.
    [Fact]
    public async Task Events_filter_by_chapter_id_and_by_organisation_wide()
    {
        var toronto = await factory.AddChapterAsync($"Toronto {Guid.NewGuid():N}"[..14]);
        var title = $"Night {Guid.NewGuid():N}"[..12];
        var tagged = await factory.AddEventAsync($"{title} Toronto", TimeSpan.FromDays(5), toronto.Name);
        var wide = await factory.AddEventAsync($"{title} wide", TimeSpan.FromDays(6), city: null);
        var client = factory.ClientFor(await factory.AddMemberAsync("Leah Thompson"));

        var inToronto = await client.GetFromJsonAsync<JsonElement>($"/api/events?chapter={toronto.Id}");
        var organisationWide = await client.GetFromJsonAsync<JsonElement>("/api/events?chapter=none");

        var ids = Ids(inToronto);
        Assert.Contains(tagged.Id, ids);
        Assert.DoesNotContain(wide.Id, ids);
        Assert.False(inToronto.TryGetProperty("cities", out _));
        Assert.Contains(wide.Id, Ids(organisationWide));
        Assert.DoesNotContain(tagged.Id, Ids(organisationWide));
        Assert.All(organisationWide.GetProperty("events").EnumerateArray(), e => Assert.Equal(JsonValueKind.Null, e.GetProperty("chapterId").ValueKind));
    }

    // L2-142 AC3: with chapters off, neither a chapter nor "none" narrows the events.
    [Fact]
    public async Task With_chapters_off_the_events_ignore_the_chapter_filter()
    {
        var (client, _, downtown) = await CampusesAsync();
        var tagged = await AddEventAsync(client, downtown);
        var wide = await AddEventAsync(client, null);
        await TurnChaptersOffAsync(client);

        var byChapter = Ids(await client.GetFromJsonAsync<JsonElement>($"/api/events?chapter={downtown}"));
        var byNone = Ids(await client.GetFromJsonAsync<JsonElement>("/api/events?chapter=none"));

        Assert.Contains(tagged, byChapter);
        Assert.Contains(wide, byChapter);
        Assert.Contains(tagged, byNone);
    }

    private static List<Guid> Ids(JsonElement list) =>
        [.. list.GetProperty("events").EnumerateArray().Select(e => e.GetProperty("id").GetGuid())];

    private static async Task<Guid> AddEventAsync(HttpClient client, Guid? chapterId)
    {
        var start = DateTimeOffset.UtcNow.AddDays(10);
        var response = await client.PostAsJsonAsync("/api/events", new
        {
            title = "Makers Night",
            description = "An evening for makers.",
            type = "BuildersNight",
            startsAt = start,
            endsAt = start.AddHours(2),
            chapterId,
            format = "InPerson",
            venue = "The Hall",
            onlineLink = (string?)null,
            capacity = (int?)null,
            visibility = "Public",
        });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
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
