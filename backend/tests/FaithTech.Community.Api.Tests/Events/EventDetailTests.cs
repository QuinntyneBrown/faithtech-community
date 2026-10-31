// Traces to: L2-020, L2-022
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Events;
using FaithTech.Community.Domain.Profiles;

namespace FaithTech.Community.Api.Tests.Events;

public class EventDetailTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    [Fact]
    public async Task Anonymous_visitor_gets_401_for_an_event()
    {
        var existing = await factory.AddEventAsync("Builders Night", TimeSpan.FromDays(7));

        var response = await factory.CreateClient().GetAsync($"/api/events/{existing.Id}");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Unknown_event_is_404()
    {
        var member = await factory.AddMemberAsync("Leah Thompson");

        var response = await factory.ClientFor(member).GetAsync($"/api/events/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task A_member_gets_every_detail_the_edit_form_needs()
    {
        var existing = await factory.AddEventAsync("Prayer & Planning", TimeSpan.FromDays(7), city: "Austin",
            type: "prayer-and-planning", format: EventFormat.Online, visibility: EventVisibility.Public, capacity: 30, rsvps: 2);
        var member = await factory.AddMemberAsync("Leah Thompson");

        var json = await factory.ClientFor(member, Role.Attendee).GetFromJsonAsync<JsonElement>($"/api/events/{existing.Id}");

        Assert.Equal(existing.Id, json.GetProperty("id").GetGuid());
        Assert.Equal("Prayer & Planning", json.GetProperty("title").GetString());
        Assert.Equal("About Prayer & Planning.", json.GetProperty("description").GetString());
        Assert.Equal("prayer-and-planning", json.GetProperty("type").GetString());
        Assert.Equal("Prayer & planning", json.GetProperty("typeName").GetString());
        Assert.Equal(existing.StartsAt, json.GetProperty("startsAt").GetDateTimeOffset());
        Assert.Equal(existing.EndsAt, json.GetProperty("endsAt").GetDateTimeOffset());
        Assert.Equal("Austin", json.GetProperty("chapterName").GetString());
        Assert.Equal("Online", json.GetProperty("format").GetString());
        Assert.Equal(JsonValueKind.Null, json.GetProperty("venue").ValueKind);
        Assert.Equal("https://meet.example.org/ft", json.GetProperty("onlineLink").GetString());
        Assert.Equal(30, json.GetProperty("capacity").GetInt32());
        Assert.Equal("Public", json.GetProperty("visibility").GetString());
        Assert.Equal(2, json.GetProperty("rsvpCount").GetInt32());
        Assert.False(json.GetProperty("isCancelled").GetBoolean());
        Assert.False(json.GetProperty("canManage").GetBoolean());
    }

    [Theory]
    [InlineData(Role.EventLead)]
    [InlineData(Role.CityLead)]
    [InlineData(Role.SystemAdmin)]
    public async Task Event_managers_are_told_they_can_manage_the_event(Role role)
    {
        var existing = await factory.AddEventAsync("Builders Night", TimeSpan.FromDays(7));
        var lead = await factory.AddMemberAsync("Grace Okonkwo");

        var json = await factory.ClientFor(lead, role).GetFromJsonAsync<JsonElement>($"/api/events/{existing.Id}");

        Assert.True(json.GetProperty("canManage").GetBoolean());
    }
}
