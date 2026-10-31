// Traces to: L2-019, L2-046
using FaithTech.Community.Api.Tests.Organisations;
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Team;

/// <summary>The team list is paged, at most 100 a page, filtered and ordered before paging (L2-046 AC3).</summary>
public class TeamPagingTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    [Fact]
    public async Task Pages_hold_50_by_default_and_never_more_than_100()
    {
        await AddTeamAsync(130, i => i % 2 == 0 ? "Toronto" : $"City {i:000}");
        var client = await ViewerAsync();

        var first = await PageAsync(client, "/api/team");
        var oversized = await PageAsync(client, "/api/team?pageSize=500");

        Assert.Equal(50, first.Members.Count);
        Assert.NotNull(first.Next);
        Assert.True(first.TotalCount >= 130);
        Assert.Equal(100, oversized.Members.Count);
    }

    [Fact]
    public async Task Following_next_with_filters_reaches_every_match_once_in_name_order()
    {
        var added = await AddTeamAsync(90, i => i % 3 == 0 ? "Halifax" : "Calgary", sameNameEvery: 4);
        var client = await ViewerAsync();
        var expected = added.Where(m => m.City == "Halifax" && m.Volunteer).Select(m => m.ProfileId).ToHashSet();

        var seen = new List<Member>();
        var halifax = await factory.ChapterIdAsync("Halifax");
        var page = await PageAsync(client, $"/api/team?role=Volunteers&chapter={halifax}&pageSize=7");
        seen.AddRange(page.Members);
        while (page.Next is { } next)
        {
            page = await PageAsync(client, $"/api/team?role=Volunteers&chapter={halifax}&pageSize=7&after={Uri.EscapeDataString(next)}");
            seen.AddRange(page.Members);
        }

        Assert.Equal(expected.Count, seen.Count);
        Assert.Equal(expected, seen.Select(m => m.ProfileId).ToHashSet());
        Assert.Equal(seen.OrderBy(m => m.Name, StringComparer.OrdinalIgnoreCase).Select(m => m.Name), seen.Select(m => m.Name));
        Assert.Equal(expected.Count, page.TotalCount);
    }

    [Fact]
    public async Task A_member_whose_team_role_is_removed_drops_off_the_next_request()
    {
        var added = await AddTeamAsync(3, _ => "Regina");
        var client = await ViewerAsync();
        await factory.WithDbAsync(async db =>
        {
            var profile = await db.Profiles.SingleAsync(p => p.Id == added[0].ProfileId);
            foreach (var role in profile.Roles.Select(r => r.Role).ToList())
            {
                profile.RemoveRole(role);
            }

            return await db.SaveChangesAsync();
        });

        var page = await PageAsync(client, $"/api/team?chapter={await factory.ChapterIdAsync("Regina")}");

        Assert.DoesNotContain(page.Members, m => m.ProfileId == added[0].ProfileId);
        Assert.Equal(2, page.TotalCount);
    }

    [Fact]
    public async Task A_malformed_continuation_is_a_validation_error()
    {
        var client = await ViewerAsync();

        var response = await client.GetAsync("/api/team?after=not-a-cursor");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    private async Task<HttpClient> ViewerAsync() => factory.ClientFor(await factory.AddMemberAsync("Leah Thompson"));

    /// <summary>Team members named so several share a name, which makes ties on name need a stable order.</summary>
    private async Task<List<Added>> AddTeamAsync(int count, Func<int, string> city, int sameNameEvery = 1)
    {
        var added = new List<Added>();
        for (var i = 0; i < count; i++)
        {
            var name = $"Member {i / sameNameEvery:000}";
            var volunteer = i % 2 == 0;
            var home = city(i);
            var chapterId = await factory.ChapterIdAsync(home);
            var member = await factory.AddMemberAsync(name, p =>
            {
                p.Update(name, chapterId, null);
                p.AddRole(volunteer ? Role.Volunteer : Role.EventLead, Guid.Empty, DateTime.UtcNow);
            });
            added.Add(new Added(member.ProfileId, home, volunteer));
        }

        return added;
    }

    private static async Task<TeamPage> PageAsync(HttpClient client, string url)
    {
        var response = await client.GetAsync(url);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<TeamPage>())!;
    }

    private sealed record Added(Guid ProfileId, string City, bool Volunteer);

    private sealed record Member(Guid ProfileId, string Name);

    private sealed record TeamPage(List<Member> Members, string? Next, int TotalCount);
}
