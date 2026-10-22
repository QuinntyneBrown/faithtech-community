// Traces to: L2-097 (docs/detailed-designs/events/event-check-in)
using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Profiles;

namespace FaithTech.Community.Api.Tests.Events;

public class CheckInExportTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    private static readonly TimeSpan Soon = TimeSpan.FromHours(2);

    private static string Utc(DateTimeOffset at) => at.UtcDateTime.ToString("yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture);

    // L2-097 AC1: Given a lead or System Admin, when they choose Export CSV, then the file has one row per attendee
    // with name, type (Member, Guest or Walk-in), email, RSVP'd at and checked in at (empty when not checked in).
    // L2-097 AC3: cells starting with =, +, - or @ are guarded, and values are quoted per RFC 4180.
    [Theory]
    [InlineData(Role.CityLead)]
    [InlineData(Role.EventLead)]
    [InlineData(Role.CreateLead)]
    [InlineData(Role.CommunicationsLead)]
    [InlineData(Role.SystemAdmin)]
    public async Task Leads_and_System_Admins_export_the_attendance_as_csv(Role role)
    {
        var ruth = await factory.AddMemberAsync("Ruth Alvarez");
        var e = await factory.AddEventAsync("Toronto Builders Night", Soon, members: [ruth.ProfileId],
            guests: [("=HYPERLINK(\"x\")", "abby@example.org")]);
        var client = factory.ClientFor(await factory.AddMemberAsync("Grace Okonkwo"), role);
        var page = await client.GetFromJsonAsync<JsonElement>($"/api/events/{e.Id}/check-in");
        var ruthRsvp = page.GetProperty("attendees")[0].GetProperty("rsvpId").GetGuid();
        await client.PutAsync($"/api/events/{e.Id}/check-ins/{ruthRsvp}", null);
        await client.PostAsJsonAsync($"/api/events/{e.Id}/walk-ins", new { name = "Mira, Chen", email = "mira@example.org" });
        var now = Utc(factory.Time.GetUtcNow());
        var rsvpedAt = (await factory.LoadEventAsync(e.Id)).Rsvps.OrderBy(r => r.CreatedAt).Select(r => Utc(r.CreatedAt)).ToList();

        var response = await client.GetAsync($"/api/events/{e.Id}/check-ins.csv");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("text/csv", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal("toronto-builders-night-attendance.csv",
            response.Content.Headers.ContentDisposition?.FileNameStar ?? response.Content.Headers.ContentDisposition?.FileName);
        Assert.Equal(
            "\"Name\",\"Type\",\"Email\",\"RSVP'd (UTC)\",\"Checked in (UTC)\"\r\n" +
            $"\"Ruth Alvarez\",\"Member\",\"\",\"{rsvpedAt[0]}\",\"{now}\"\r\n" +
            $"\"'=HYPERLINK(\"\"x\"\")\",\"Guest\",\"abby@example.org\",\"{rsvpedAt[1]}\",\"\"\r\n" +
            $"\"Mira, Chen\",\"Walk-in\",\"mira@example.org\",\"{now}\",\"{now}\"\r\n",
            await response.Content.ReadAsStringAsync());
    }

    // L2-097 AC2: Given Staff, a member without a lead role, or an anonymous visitor, when they request the export,
    // then the response is 403, or 401 for the anonymous visitor.
    [Theory]
    [InlineData(Role.Staff)]
    [InlineData(Role.Attendee)]
    public async Task Staff_and_members_cannot_export_the_attendance(Role role)
    {
        var e = await factory.AddEventAsync("Toronto Builders Night", Soon, rsvps: 1);
        var client = factory.ClientFor(await factory.AddMemberAsync("Sam Rivera"), role);

        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync($"/api/events/{e.Id}/check-ins.csv")).StatusCode);
    }

    [Fact]
    public async Task Anonymous_visitors_get_401_and_an_unknown_event_is_404()
    {
        var lead = factory.ClientFor(await factory.AddMemberAsync("Grace Okonkwo"), Role.EventLead);

        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.CreateClient().GetAsync($"/api/events/{Guid.NewGuid()}/check-ins.csv")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await lead.GetAsync($"/api/events/{Guid.NewGuid()}/check-ins.csv")).StatusCode);
    }
}
