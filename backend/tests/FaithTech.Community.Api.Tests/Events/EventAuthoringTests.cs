// Traces to: L2-020
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Events;
using FaithTech.Community.Domain.Notifications;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Events;

public class EventAuthoringTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    private DateTimeOffset Start => factory.Time.GetUtcNow().AddDays(14);

    private object Request(
        string title = "Toronto Builders Night",
        string format = "InPerson",
        string? venue = "Kestrel Labs, 220 King St W",
        string? onlineLink = null,
        DateTimeOffset? starts = null,
        DateTimeOffset? ends = null,
        int? capacity = 60,
        string type = "BuildersNight",
        string visibility = "Public",
        string city = "Toronto") => new
        {
            title,
            description = "An evening for Christians who build.",
            type,
            startsAt = starts ?? Start,
            endsAt = ends ?? (starts ?? Start).AddHours(2.5),
            city,
            format,
            venue,
            onlineLink,
            capacity,
            visibility,
        };

    [Fact]
    public async Task Anonymous_visitor_gets_401_for_create()
    {
        var response = await factory.CreateClient().PostAsJsonAsync("/api/events", Request());

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // AC1: Given an Event Lead, City Lead or System Admin, when they create an event with every field, then it is saved.
    [Theory]
    [InlineData(Role.EventLead)]
    [InlineData(Role.CityLead)]
    [InlineData(Role.SystemAdmin)]
    public async Task Event_manager_creates_an_event_with_every_field(Role role)
    {
        var lead = await factory.AddMemberAsync("Grace Okonkwo");

        var response = await factory.ClientFor(lead, role).PostAsJsonAsync("/api/events", Request(type: "Hackathon", visibility: "MembersOnly"));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var id = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        Assert.Equal($"/api/events/{id}", response.Headers.Location?.OriginalString);
        var saved = await factory.LoadEventAsync(id);
        Assert.Equal(
            ("Toronto Builders Night", "An evening for Christians who build.", EventType.Hackathon, Start, Start.AddHours(2.5), "Toronto"),
            (saved.Title, saved.Description, saved.Type, saved.StartsAt, saved.EndsAt, saved.City));
        Assert.Equal(
            (EventFormat.InPerson, (string?)"Kestrel Labs, 220 King St W", (string?)null, (int?)60, EventVisibility.MembersOnly, lead.ProfileId),
            (saved.Format, saved.Venue, saved.OnlineLink, saved.Capacity, saved.Visibility, saved.CreatedById));
    }

    [Fact]
    public async Task An_online_event_keeps_its_link_and_no_venue_and_capacity_is_optional()
    {
        var lead = await factory.AddMemberAsync("Grace Okonkwo");

        var response = await factory.ClientFor(lead, Role.EventLead).PostAsJsonAsync("/api/events",
            Request(format: "Online", venue: "ignored", onlineLink: "https://meet.example.org/ft", capacity: null));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var saved = await factory.LoadEventAsync((await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid());
        Assert.Equal((EventFormat.Online, (string?)null, (string?)"https://meet.example.org/ft", (int?)null),
            (saved.Format, saved.Venue, saved.OnlineLink, saved.Capacity));
    }

    // AC2: an end before the start, an in-person event with no venue, or an online event with no link is refused
    // with field errors the form shows inline.
    [Fact]
    public async Task End_before_start_is_400_on_EndsAt()
    {
        var errors = await PostInvalidAsync(Request(starts: Start, ends: Start.AddHours(-1)));

        Assert.Equal(["The end time must be after the start time."], errors["EndsAt"]);
    }

    [Fact]
    public async Task In_person_event_without_a_venue_is_400_on_Venue()
    {
        var errors = await PostInvalidAsync(Request(venue: " "));

        Assert.Equal(["Enter a venue address, or choose Online."], errors["Venue"]);
    }

    [Fact]
    public async Task Online_event_without_a_link_is_400_on_OnlineLink()
    {
        var errors = await PostInvalidAsync(Request(format: "Online", venue: null, onlineLink: null));

        Assert.Equal(["Enter the joining link, or choose In person."], errors["OnlineLink"]);
    }

    [Fact]
    public async Task Blank_title_and_city_unknown_type_and_a_capacity_below_one_are_400()
    {
        var errors = await PostInvalidAsync(Request(title: " ", city: "", type: "Party", capacity: 0));

        Assert.Equal(["Give the event a title people will recognise."], errors["Title"]);
        Assert.Equal(["Enter the city the event is in."], errors["City"]);
        Assert.Equal(["Choose a type from the list."], errors["Type"]);
        Assert.Equal(["Capacity must be at least 1, or leave it empty for no limit."], errors["Capacity"]);
    }

    [Fact]
    public async Task A_joining_link_must_be_a_web_address()
    {
        var errors = await PostInvalidAsync(Request(format: "Online", venue: null, onlineLink: "javascript:alert(1)"));

        Assert.Equal(["Enter a link that starts with https://"], errors["OnlineLink"]);
    }

    // AC3: Given any other role, when it calls the create or edit API, then the response is 403.
    [Theory]
    [InlineData]
    [InlineData(Role.Staff)]
    [InlineData(Role.Volunteer)]
    [InlineData(Role.Attendee)]
    [InlineData(Role.CreateLead, Role.CommunicationsLead, Role.ProductEngineer)]
    public async Task Any_other_role_gets_403_for_create_and_edit(params Role[] roles)
    {
        var member = await factory.AddMemberAsync("Leah Thompson");
        var existing = await factory.AddEventAsync("Builders Night", TimeSpan.FromDays(7));
        var client = factory.ClientFor(member, roles);

        var create = await client.PostAsJsonAsync("/api/events", Request());
        var edit = await client.PutAsJsonAsync($"/api/events/{existing.Id}", Request());

        Assert.Equal(HttpStatusCode.Forbidden, create.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, edit.StatusCode);
        Assert.Equal("Builders Night", (await factory.LoadEventAsync(existing.Id)).Title);
    }

    [Fact]
    public async Task Event_manager_edits_an_event_and_its_sequence_goes_up()
    {
        var lead = await factory.AddMemberAsync("Grace Okonkwo");
        var existing = await factory.AddEventAsync("Builders Night", TimeSpan.FromDays(7));

        var response = await factory.ClientFor(lead, Role.CityLead).PutAsJsonAsync($"/api/events/{existing.Id}",
            Request(title: "Builders Night (new venue)", venue: "Trinity Community Centre", capacity: null));

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var saved = await factory.LoadEventAsync(existing.Id);
        Assert.Equal(("Builders Night (new venue)", (string?)"Trinity Community Centre", (int?)null, 1),
            (saved.Title, saved.Venue, saved.Capacity, saved.Sequence));
    }

    [Fact]
    public async Task Editing_an_unknown_event_is_404_and_an_invalid_edit_changes_nothing()
    {
        var lead = await factory.AddMemberAsync("Grace Okonkwo");
        var existing = await factory.AddEventAsync("Builders Night", TimeSpan.FromDays(7));
        var client = factory.ClientFor(lead, Role.EventLead);

        var unknown = await client.PutAsJsonAsync($"/api/events/{Guid.NewGuid()}", Request());
        var invalid = await client.PutAsJsonAsync($"/api/events/{existing.Id}", Request(venue: null));

        Assert.Equal(HttpStatusCode.NotFound, unknown.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
        var saved = await factory.LoadEventAsync(existing.Id);
        Assert.Equal(("Builders Night", 0), (saved.Title, saved.Sequence));
    }

    [Fact]
    public async Task A_cancelled_event_cannot_be_edited()
    {
        var lead = await factory.AddMemberAsync("Grace Okonkwo");
        var existing = await factory.AddEventAsync("Builders Night", TimeSpan.FromDays(7), cancelledBecause: "Venue flooded.");

        var response = await factory.ClientFor(lead, Role.EventLead).PutAsJsonAsync($"/api/events/{existing.Id}", Request());

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    // AC4: Given an event, when it is edited, then everyone who RSVP'd receives an in-app notification of the change.
    [Fact]
    public async Task Editing_notifies_every_member_who_rsvpd_in_app()
    {
        var lead = await factory.AddMemberAsync("Grace Okonkwo");
        var existing = await factory.AddEventAsync("Builders Night", TimeSpan.FromDays(7), rsvps: 2);
        var notified = existing.Rsvps.Select(r => r.ProfileId!.Value).ToHashSet();

        var response = await factory.ClientFor(lead, Role.EventLead).PutAsJsonAsync($"/api/events/{existing.Id}",
            Request(title: "Builders Night", venue: "Trinity Community Centre"));

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var notifications = await factory.WithDbAsync(db => db.Notifications.AsNoTracking()
            .Where(n => notified.Contains(n.RecipientId)).ToListAsync());
        Assert.Equal(notified, notifications.Select(n => n.RecipientId).ToHashSet());
        Assert.All(notifications, n =>
        {
            Assert.Equal(NotificationKind.EventChanged, n.Kind);
            Assert.Equal("Builders Night changed. Check the new details.", n.Title);
            Assert.Equal($"/events/{existing.Id}", n.LinkPath);
        });
    }

    [Fact]
    public async Task A_System_Admin_acting_without_an_event_role_is_audited()
    {
        var admin = await factory.AddMemberAsync("Priya Shah");
        var existing = await factory.AddEventAsync("Builders Night", TimeSpan.FromDays(7));

        var response = await factory.ClientFor(admin, Role.SystemAdmin).PutAsJsonAsync($"/api/events/{existing.Id}",
            Request(title: "Builders Night (moved)"));

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var entry = await factory.WithDbAsync(db => db.AuditEntries.AsNoTracking()
            .SingleAsync(e => e.TargetId == existing.Id.ToString()));
        Assert.Equal(("event.updated", "Event", admin.ProfileId), (entry.Action, entry.TargetType, entry.ActorId));
    }

    private async Task<Dictionary<string, string[]>> PostInvalidAsync(object request)
    {
        var lead = await factory.AddMemberAsync("Grace Okonkwo");
        var response = await factory.ClientFor(lead, Role.EventLead).PostAsJsonAsync("/api/events", request);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<JsonElement>();
        return problem.GetProperty("errors").Deserialize<Dictionary<string, string[]>>()!;
    }
}
