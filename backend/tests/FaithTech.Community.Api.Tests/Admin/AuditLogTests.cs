// Traces to: L2-041
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Admin;
using FaithTech.Community.Domain.Profiles;

namespace FaithTech.Community.Api.Tests.Admin;

public class AuditLogTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    [Theory]
    [InlineData]
    [InlineData(Role.Staff)]
    [InlineData(Role.CityLead)]
    public async Task Anyone_but_a_system_admin_gets_403(params Role[] roles)
    {
        var member = await factory.AddMemberAsync("Daniel Reyes");

        var response = await factory.ClientFor(member, roles).GetAsync("/api/admin/audit");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task System_admin_sees_when_who_and_what_newest_first_for_the_last_90_days()
    {
        var priya = await factory.AddMemberAsync("Priya Shah");
        var esther = await factory.AddMemberAsync("Esther Nakamura");
        var now = factory.Time.GetUtcNow().UtcDateTime;
        await AddEntriesAsync(
            Entry(priya, "role.granted", esther, now.AddHours(-1), new { Roles = Array.Empty<string>() }, new { Roles = new[] { "CityLead" } }),
            Entry(priya, "user.suspended", esther, now.AddHours(-2), null, new { Reason = "Spam event listings" }),
            Entry(priya, "role.removed", esther, now.AddDays(-91), new { Roles = new[] { "Staff" } }, new { Roles = Array.Empty<string>() }));

        var page = await factory.ClientFor(priya, Role.SystemAdmin)
            .GetFromJsonAsync<Page>($"/api/admin/audit?actor={priya.ProfileId}");

        Assert.Equal(2, page!.TotalCount);
        Assert.Equal(50, page.PageSize);
        Assert.Equal(["role.granted", "user.suspended"], page.Items.Select(i => i.Action));
        var granted = page.Items[0];
        Assert.Equal("Priya Shah", granted.ActorName);
        Assert.Equal("Granted City Lead to Esther Nakamura", granted.Summary);
        Assert.Equal("Suspended Esther Nakamura — reason: Spam event listings", page.Items[1].Summary);
        Assert.Equal("10.0.0.1", granted.IpAddress);
        Assert.Contains("CityLead", granted.After);
    }

    [Fact]
    public async Task Category_filter_keeps_only_matching_actions()
    {
        var priya = await factory.AddMemberAsync("Priya Shah");
        var victor = await factory.AddMemberAsync("Victor Kane");
        var now = factory.Time.GetUtcNow().UtcDateTime;
        await AddEntriesAsync(
            Entry(priya, "role.granted", victor, now.AddMinutes(-3), new { Roles = Array.Empty<string>() }, new { Roles = new[] { "Volunteer" } }),
            Entry(priya, "user.suspended", victor, now.AddMinutes(-2), null, new { Reason = "Spam" }),
            Entry(priya, "user.reinstated", victor, now.AddMinutes(-1), null, null),
            Entry(priya, "profile.photo.deleted", victor, now.AddMinutes(-1), null, null));
        var client = factory.ClientFor(priya, Role.SystemAdmin);

        var suspensions = await client.GetFromJsonAsync<Page>($"/api/admin/audit?actor={priya.ProfileId}&category=suspensions");
        var deletions = await client.GetFromJsonAsync<Page>($"/api/admin/audit?actor={priya.ProfileId}&category=deletions");
        var roles = await client.GetFromJsonAsync<Page>($"/api/admin/audit?actor={priya.ProfileId}&category=roles");

        Assert.Equal(["user.reinstated", "user.suspended"], suspensions!.Items.Select(i => i.Action));
        Assert.Equal(["profile.photo.deleted"], deletions!.Items.Select(i => i.Action));
        Assert.Equal(["role.granted"], roles!.Items.Select(i => i.Action));
    }

    [Fact]
    public async Task Entries_are_paged_50_at_a_time()
    {
        var priya = await factory.AddMemberAsync("Priya Shah");
        var now = factory.Time.GetUtcNow().UtcDateTime;
        await AddEntriesAsync([.. Enumerable.Range(0, 51).Select(i =>
            Entry(priya, "profile.updated", priya, now.AddMinutes(-i), null, null))]);
        var client = factory.ClientFor(priya, Role.SystemAdmin);

        var first = await client.GetFromJsonAsync<Page>($"/api/admin/audit?actor={priya.ProfileId}");
        var second = await client.GetFromJsonAsync<Page>($"/api/admin/audit?actor={priya.ProfileId}&page=2");

        Assert.Equal(51, first!.TotalCount);
        Assert.Equal(50, first.Items.Count);
        Assert.Single(second!.Items);
    }

    [Theory]
    [InlineData("PUT")]
    [InlineData("PATCH")]
    [InlineData("DELETE")]
    public async Task No_api_edits_or_deletes_an_entry(string method)
    {
        var priya = await factory.AddMemberAsync("Priya Shah");
        var entry = Entry(priya, "user.reinstated", priya, factory.Time.GetUtcNow().UtcDateTime, null, null);
        await AddEntriesAsync(entry);

        var response = await factory.ClientFor(priya, Role.SystemAdmin)
            .SendAsync(new HttpRequestMessage(new HttpMethod(method), $"/api/admin/audit/{entry.Id}") { Content = JsonContent.Create(new { }) });

        Assert.Contains(response.StatusCode, new[] { HttpStatusCode.NotFound, HttpStatusCode.MethodNotAllowed });
        Assert.True(await factory.WithDbAsync(async db => await db.AuditEntries.FindAsync(entry.Id) is not null));
    }

    [Fact]
    public async Task Export_downloads_the_filtered_entries_as_csv()
    {
        var priya = await factory.AddMemberAsync("Priya Shah");
        var daniel = await factory.AddMemberAsync("Daniel Reyes");
        var now = factory.Time.GetUtcNow().UtcDateTime;
        await AddEntriesAsync(
            Entry(priya, "role.granted", daniel, now.AddMinutes(-2), new { Roles = Array.Empty<string>() }, new { Roles = new[] { "Staff" } }),
            Entry(priya, "user.suspended", daniel, now.AddMinutes(-1), null, new { Reason = "Spam, again" }));

        var response = await factory.ClientFor(priya, Role.SystemAdmin)
            .GetAsync($"/api/admin/audit/export?actor={priya.ProfileId}&category=roles");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("text/csv", response.Content.Headers.ContentType!.MediaType);
        Assert.Contains("attachment", response.Content.Headers.ContentDisposition!.DispositionType);
        var lines = (await response.Content.ReadAsStringAsync()).TrimEnd().Split('\n');
        Assert.Equal("When (UTC),Who,Action,Summary,Target type,Target id,IP address", lines[0].TrimEnd('\r'));
        Assert.Equal(2, lines.Length);
        Assert.Contains("Granted Staff to Daniel Reyes", lines[1]);
    }

    [Fact]
    public async Task Export_is_403_to_anyone_but_a_system_admin()
    {
        var member = await factory.AddMemberAsync("Daniel Reyes");

        var response = await factory.ClientFor(member, Role.Staff).GetAsync("/api/admin/audit/export");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    private static AuditEntry Entry(ProfileClients.Member actor, string action, ProfileClients.Member target, DateTime at, object? before, object? after) =>
        new(actor.ProfileId, action, "Profile", target.ProfileId.ToString(),
            before is null ? null : System.Text.Json.JsonSerializer.Serialize(before),
            after is null ? null : System.Text.Json.JsonSerializer.Serialize(after),
            at, "10.0.0.1");

    private Task AddEntriesAsync(params AuditEntry[] entries) => factory.WithDbAsync(async db =>
    {
        db.AuditEntries.AddRange(entries);
        return await db.SaveChangesAsync();
    });

    private sealed record Item(Guid Id, DateTime OccurredAtUtc, Guid ActorId, string ActorName, string Action, string TargetType, string TargetId, string Summary, string? Before, string? After, string IpAddress);

    private sealed record Page(List<Item> Items, int Page_, int PageSize, int TotalCount);
}
