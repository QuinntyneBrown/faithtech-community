// Traces to: L2-024
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Events;
using FaithTech.Community.Domain.Profiles;

namespace FaithTech.Community.Api.Tests.Events;

public class CalendarExportTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    private static readonly TimeSpan Week = TimeSpan.FromDays(7);

    // AC1: Given any event a user can see, when they download its .ics, then the file is valid RFC 5545 with the
    // title, times in UTC, location or link, and a stable UID.
    [Fact]
    public async Task A_member_downloads_any_event_as_an_rfc5545_calendar_file()
    {
        var existing = await factory.AddEventAsync("Toronto Builders Night", Week, visibility: EventVisibility.MembersOnly);
        var leah = await factory.AddMemberAsync("Leah Thompson");

        var response = await factory.ClientFor(leah).GetAsync($"/api/events/{existing.Id}/calendar.ics");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("text/calendar", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal("toronto-builders-night.ics", response.Content.Headers.ContentDisposition?.FileName?.Trim('"'));
        var lines = await LinesAsync(response);
        Assert.Equal("BEGIN:VCALENDAR", lines[0]);
        Assert.Contains($"UID:{existing.Id}@faithtech.community", lines);
        Assert.Contains("SUMMARY:Toronto Builders Night", lines);
        Assert.Contains($"DTSTART:{existing.StartsAt.UtcDateTime:yyyyMMdd'T'HHmmss'Z'}", lines);
        Assert.Contains($"DTEND:{existing.EndsAt.UtcDateTime:yyyyMMdd'T'HHmmss'Z'}", lines);
        Assert.Contains("LOCATION:Kestrel Labs\\, 220 King St W\\, Toronto", lines);
        Assert.Contains("SEQUENCE:0", lines);
    }

    [Fact]
    public async Task A_member_gets_an_online_events_joining_link_as_the_url()
    {
        var existing = await factory.AddEventAsync("Prayer & Planning", Week, format: EventFormat.Online);
        var leah = await factory.AddMemberAsync("Leah Thompson");

        var lines = await LinesAsync(await factory.ClientFor(leah).GetAsync($"/api/events/{existing.Id}/calendar.ics"));

        Assert.Contains("URL:https://meet.example.org/ft", lines);
    }

    [Fact]
    public async Task The_members_download_needs_sign_in_and_an_existing_event()
    {
        var existing = await factory.AddEventAsync("Toronto Builders Night", Week);
        var leah = await factory.AddMemberAsync("Leah Thompson");

        var anonymous = await factory.CreateClient().GetAsync($"/api/events/{existing.Id}/calendar.ics");
        var unknown = await factory.ClientFor(leah).GetAsync($"/api/events/{Guid.NewGuid()}/calendar.ics");

        Assert.Equal(HttpStatusCode.Unauthorized, anonymous.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, unknown.StatusCode);
    }

    [Fact]
    public async Task Anyone_downloads_a_public_event_but_never_a_members_only_one()
    {
        var open = await factory.AddEventAsync("Toronto Builders Night", Week, visibility: EventVisibility.Public);
        var hidden = await factory.AddEventAsync("City Team Prayer", Week, visibility: EventVisibility.MembersOnly);
        var client = factory.CreateClient();

        var shown = await client.GetAsync($"/api/public/events/{open.Id}/calendar.ics");
        var refused = await client.GetAsync($"/api/public/events/{hidden.Id}/calendar.ics");

        Assert.Equal(HttpStatusCode.OK, shown.StatusCode);
        Assert.Equal("text/calendar", shown.Content.Headers.ContentType?.MediaType);
        Assert.Contains($"UID:{open.Id}@faithtech.community", await LinesAsync(shown));
        Assert.Equal(HttpStatusCode.NotFound, refused.StatusCode);
    }

    [Fact]
    public async Task The_public_download_keeps_an_online_events_joining_link_for_people_who_rsvp()
    {
        var existing = await factory.AddEventAsync("Prayer & Planning", Week, format: EventFormat.Online, visibility: EventVisibility.Public);

        var lines = await LinesAsync(await factory.CreateClient().GetAsync($"/api/public/events/{existing.Id}/calendar.ics"));

        Assert.DoesNotContain(lines, l => l.Contains("meet.example.org", StringComparison.Ordinal));
        Assert.Contains($"URL:{CommunityApiFactory.WebAppOrigin}/public/events/{existing.Id}", lines);
    }

    // AC2: Given an event that is changed or cancelled, when the .ics is downloaded again, then it carries a higher
    // SEQUENCE number, and STATUS:CANCELLED if cancelled.
    [Fact]
    public async Task A_changed_then_cancelled_event_downloads_with_a_higher_sequence_and_the_cancelled_status()
    {
        var existing = await factory.AddEventAsync("Toronto Builders Night", Week, visibility: EventVisibility.Public);
        var lead = await factory.AddMemberAsync("Grace Okonkwo");
        var client = factory.ClientFor(lead, Role.EventLead);
        var before = await LinesAsync(await client.GetAsync($"/api/events/{existing.Id}/calendar.ics"));

        (await client.PutAsJsonAsync($"/api/events/{existing.Id}", new
        {
            title = "Toronto Builders Night",
            description = "New venue.",
            type = "Gathering",
            startsAt = existing.StartsAt,
            endsAt = existing.EndsAt,
            chapterId = existing.ChapterId,
            format = "InPerson",
            venue = "Trinity Community Centre",
            visibility = "Public",
        })).EnsureSuccessStatusCode();
        var changed = await LinesAsync(await client.GetAsync($"/api/events/{existing.Id}/calendar.ics"));
        await factory.CancelEventAsync(existing.Id, "The venue flooded.");
        var cancelled = await LinesAsync(await factory.CreateClient().GetAsync($"/api/public/events/{existing.Id}/calendar.ics"));

        Assert.Contains("SEQUENCE:0", before);
        Assert.Contains("STATUS:CONFIRMED", before);
        Assert.Contains("SEQUENCE:1", changed);
        Assert.Contains("LOCATION:Trinity Community Centre\\, Toronto", changed);
        Assert.Contains("SEQUENCE:2", cancelled);
        Assert.Contains("STATUS:CANCELLED", cancelled);
        Assert.Equal(before.Single(l => l.StartsWith("UID:")), cancelled.Single(l => l.StartsWith("UID:")));
    }

    private static async Task<string[]> LinesAsync(HttpResponseMessage response)
    {
        response.EnsureSuccessStatusCode();
        var text = await response.Content.ReadAsStringAsync();
        return text.Replace("\r\n ", string.Empty).Split("\r\n");
    }
}
