// Traces to: L2-010, L2-046
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Profiles;

namespace FaithTech.Community.Api.Tests.Invites;

/// <summary>The invites list is paged, at most 100 a page, newest first (L2-046 AC3, L2-010 AC4).</summary>
public class InvitesPagingTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    [Fact]
    public async Task Pages_hold_50_by_default_and_never_more_than_100()
    {
        var grace = await AddInvitesAsync(120);
        var client = factory.ClientFor(grace, Role.CityLead);

        var first = await PageAsync(client, "/api/invites");
        var oversized = await PageAsync(client, "/api/invites?pageSize=500");

        Assert.Equal(50, first.Items.Count);
        Assert.NotNull(first.Next);
        Assert.True(first.TotalCount >= 120);
        Assert.Equal(100, oversized.Items.Count);
    }

    [Fact]
    public async Task Following_next_reaches_every_invite_once_newest_first_even_when_one_is_sent_meanwhile()
    {
        var grace = await AddInvitesAsync(75);
        var client = factory.ClientFor(grace, Role.CityLead);
        var expected = (await AllAsync(client)).Select(i => i.Id).ToList();

        var seen = new List<Invite>();
        var page = await PageAsync(client, "/api/invites?pageSize=30");
        seen.AddRange(page.Items);
        // A new invite lands at the top while the lead is reading; the next page must not shift.
        factory.Time.Advance(TimeSpan.FromMinutes(1));
        var marcus = await factory.AddMemberAsync("Marcus Lee");
        (await factory.ClientFor(marcus, Role.CityLead).PostAsJsonAsync("/api/invites", new { Email = $"{Guid.NewGuid():N}@example.org" }))
            .EnsureSuccessStatusCode();
        while (page.Next is { } next)
        {
            page = await PageAsync(client, $"/api/invites?pageSize=30&after={Uri.EscapeDataString(next)}");
            seen.AddRange(page.Items);
        }

        Assert.Equal(expected, seen.Select(i => i.Id));
        Assert.Equal(seen.OrderByDescending(i => i.CreatedAt).Select(i => i.Id), seen.Select(i => i.Id));
    }

    [Fact]
    public async Task Every_page_is_refused_to_members_without_a_lead_role_and_to_anonymous_callers()
    {
        var jonah = await factory.AddMemberAsync("Jonah Bell");

        var member = await factory.ClientFor(jonah, Role.Volunteer).GetAsync("/api/invites?pageSize=10&after=x");
        var anonymous = await factory.CreateClient().GetAsync("/api/invites?pageSize=10");

        Assert.Equal(HttpStatusCode.Forbidden, member.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, anonymous.StatusCode);
    }

    [Fact]
    public async Task A_malformed_continuation_is_a_validation_error()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");

        var response = await factory.ClientFor(grace, Role.CityLead).GetAsync("/api/invites?after=not-a-cursor");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    /// <summary>Invites from one lead; several share a creation time, so ties need a stable order.</summary>
    private async Task<ProfileClients.Member> AddInvitesAsync(int count)
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        for (var i = 0; i < count; i++)
        {
            await factory.AddInviteAsync(grace, $"{Guid.NewGuid():N}@example.org", age: TimeSpan.FromHours(i / 3));
        }

        return grace;
    }

    private static async Task<List<Invite>> AllAsync(HttpClient client)
    {
        var all = new List<Invite>();
        string? next = null;
        do
        {
            var page = await PageAsync(client, "/api/invites?pageSize=100" + (next is null ? string.Empty : $"&after={Uri.EscapeDataString(next)}"));
            all.AddRange(page.Items);
            next = page.Next;
        }
        while (next is not null);
        return all;
    }

    private static async Task<InvitePage> PageAsync(HttpClient client, string url)
    {
        var response = await client.GetAsync(url);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<InvitePage>())!;
    }

    private sealed record Invite(Guid Id, string Email, DateTimeOffset CreatedAt);

    private sealed record InvitePage(List<Invite> Items, string? Next, int TotalCount);
}
