// Traces to: L2-135 AC3, AC4, AC5; L2-020; L2-022; L2-117
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Organisations;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Events;

// Each rule is proven with a role defined in the test, so it holds for any organisation's roles (ADR 0033).
public class EventCapabilityTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    private object Request(string title = "Builders Night") => new
    {
        title,
        description = "An evening for Christians who build.",
        type = "BuildersNight",
        startsAt = factory.Time.GetUtcNow().AddDays(14),
        endsAt = factory.Time.GetUtcNow().AddDays(14).AddHours(2),
        city = "Toronto",
        format = "InPerson",
        venue = "Kestrel Labs",
        onlineLink = (string?)null,
        capacity = 60,
        visibility = "MembersOnly",
    };

    [Fact]
    public async Task ManageEvents_creates_an_event_and_without_it_the_answer_is_403()
    {
        var holder = await factory.AddMemberAsync("Grace Okonkwo");
        var other = await factory.AddMemberAsync("Jonah Bell");

        var created = await factory.ClientWithCapabilities(holder, Capability.ManageEvents).PostAsJsonAsync("/api/events", Request());
        var refused = await factory.ClientWithCapabilities(other, Capability.ViewAttendees, Capability.ManageAttendance)
            .PostAsJsonAsync("/api/events", Request());

        Assert.Equal((HttpStatusCode.Created, HttpStatusCode.Forbidden), (created.StatusCode, refused.StatusCode));
    }

    [Theory]
    [InlineData(Capability.ViewAttendees, true, false)]
    [InlineData(Capability.ManageAttendance, true, true)]
    [InlineData(Capability.ManageEvents, false, false)]
    public async Task ViewAttendees_sees_the_list_and_ManageAttendance_also_sees_guest_emails(string capability, bool seesList, bool seesEmails)
    {
        var ruth = await factory.AddMemberAsync("Ruth Alvarez");
        var existing = await factory.AddEventAsync("Builders Night", TimeSpan.FromDays(7), members: [ruth.ProfileId],
            guests: [("Abby Brooks", "abby@example.org")]);
        var viewer = await factory.AddMemberAsync("Grace Okonkwo");

        var json = await factory.ClientWithCapabilities(viewer, capability).GetFromJsonAsync<JsonElement>($"/api/events/{existing.Id}");

        var list = json.GetProperty("rsvps");
        var rsvps = list.ValueKind == JsonValueKind.Array ? list.EnumerateArray().ToList() : [];
        Assert.Equal(seesList, rsvps.Count == 2);
        Assert.Equal(seesEmails, rsvps.Any(r => r.GetProperty("guestEmail").GetString() == "abby@example.org"));
        Assert.Equal(seesEmails, json.GetProperty("canExportRsvps").GetBoolean());
    }

    [Fact]
    public async Task ManageAttendance_checks_in_unaudited_and_an_administrator_without_it_is_audited()
    {
        var existing = await factory.AddEventAsync("Builders Night", TimeSpan.FromHours(1), guests: [("Abby Brooks", "abby@example.org")]);
        var lead = factory.ClientWithCapabilities(await factory.AddMemberAsync("Grace Okonkwo"), Capability.ManageAttendance);
        var adminMember = await factory.AddMemberAsync("Priya Shah");
        var admin = factory.ClientWithCapabilities(adminMember, Capability.AdministerOrganisation);
        var rsvpId = (await lead.GetFromJsonAsync<JsonElement>($"/api/events/{existing.Id}/check-in"))
            .GetProperty("attendees").EnumerateArray().Single().GetProperty("rsvpId").GetGuid();

        Assert.True((await lead.PutAsync($"/api/events/{existing.Id}/check-ins/{rsvpId}", null)).IsSuccessStatusCode);
        Assert.True((await admin.DeleteAsync($"/api/events/{existing.Id}/check-ins/{rsvpId}")).IsSuccessStatusCode);

        var entry = await factory.WithDbAsync(db => db.AuditEntries.AsNoTracking().SingleAsync(a => a.TargetId == existing.Id.ToString()));
        Assert.Equal(("event.check_in_undone", adminMember.ProfileId), (entry.Action, entry.ActorId));
    }

    [Fact]
    public async Task An_administrator_without_ManageEvents_editing_an_event_is_audited_and_a_holder_is_not()
    {
        var existing = await factory.AddEventAsync("Builders Night", TimeSpan.FromDays(7));
        var holder = factory.ClientWithCapabilities(await factory.AddMemberAsync("Grace Okonkwo"), Capability.ManageEvents);
        var adminMember = await factory.AddMemberAsync("Priya Shah");
        var admin = factory.ClientWithCapabilities(adminMember, Capability.AdministerOrganisation);

        Assert.Equal(HttpStatusCode.NoContent, (await holder.PutAsJsonAsync($"/api/events/{existing.Id}", Request("Builders Night (moved)"))).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await admin.PutAsJsonAsync($"/api/events/{existing.Id}", Request("Builders Night (again)"))).StatusCode);

        var entry = await factory.WithDbAsync(db => db.AuditEntries.AsNoTracking().SingleAsync(a => a.TargetId == existing.Id.ToString()));
        Assert.Equal(("event.updated", adminMember.ProfileId), (entry.Action, entry.ActorId));
    }
}
