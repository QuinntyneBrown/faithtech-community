// Traces to: L2-021
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Events;
using FaithTech.Community.Domain.Profiles;

namespace FaithTech.Community.Api.Tests.Events;

public class EventListTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    private static readonly TimeSpan Day = TimeSpan.FromDays(1);

    [Fact]
    public async Task Anonymous_visitor_gets_401_for_the_event_list()
    {
        var response = await factory.CreateClient().GetAsync("/api/events");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // AC1: Given a signed-in member, when they open events, then upcoming events are listed soonest first,
    // with date, city, format and RSVP count.
    [Fact]
    public async Task Member_sees_upcoming_events_soonest_first_with_date_city_format_and_rsvp_count()
    {
        var city = UniqueCity();
        var later = await factory.AddEventAsync("Advent Build Night", 40 * Day, city, format: EventFormat.Online, visibility: EventVisibility.Public);
        var soon = await factory.AddEventAsync("Builders Night", 10 * Day, city, rsvps: 3);
        await factory.AddEventAsync("Last month's panel", -30 * Day, city, type: EventType.Panel);
        var member = await factory.AddMemberAsync("Leah Thompson");

        var list = await factory.ClientFor(member, Role.Attendee).GetFromJsonAsync<EventListResponse>($"/api/events?city={city}");

        Assert.Equal(["Builders Night", "Advent Build Night"], list!.Events.Select(e => e.Title));
        var first = list.Events[0];
        Assert.Equal(soon.Id, first.Id);
        Assert.Equal(soon.StartsAt, first.StartsAt);
        Assert.Equal(soon.EndsAt, first.EndsAt);
        Assert.Equal((city, "InPerson", "Kestrel Labs, 220 King St W", 3, "Gathering", "MembersOnly"),
            (first.City, first.Format, first.Venue, first.RsvpCount, first.Type, first.Visibility));
        Assert.Equal(("Online", 0, "Public"), (list.Events[1].Format, list.Events[1].RsvpCount, list.Events[1].Visibility));
        Assert.Equal(later.Id, list.Events[1].Id);
    }

    [Fact]
    public async Task An_event_that_has_started_but_not_ended_is_still_upcoming()
    {
        var city = UniqueCity();
        await factory.AddEventAsync("Hackathon weekend", -Day, city, type: EventType.Hackathon, lasts: 2 * Day);
        var member = await factory.AddMemberAsync("Leah Thompson");

        var list = await factory.ClientFor(member).GetFromJsonAsync<EventListResponse>($"/api/events?city={city}");

        Assert.Equal(["Hackathon weekend"], list!.Events.Select(e => e.Title));
    }

    // AC2: Given a city filter, or one of the filters Upcoming, Past, Hackathons or Online, when it is applied,
    // then only matching events are listed.
    [Theory]
    [InlineData("", new[] { "Builders Night", "Hackathon: Tech for Shelters", "Advent Build Night" })]
    [InlineData("&filter=Upcoming", new[] { "Builders Night", "Hackathon: Tech for Shelters", "Advent Build Night" })]
    [InlineData("&filter=Past", new[] { "Last week's prayer", "Spring hackathon" })]
    [InlineData("&filter=hackathons", new[] { "Hackathon: Tech for Shelters" })]
    [InlineData("&filter=Online", new[] { "Advent Build Night" })]
    public async Task The_upcoming_past_hackathon_and_online_filters_narrow_the_list(string query, string[] expected)
    {
        var city = UniqueCity();
        await factory.AddEventAsync("Builders Night", 5 * Day, city);
        await factory.AddEventAsync("Hackathon: Tech for Shelters", 20 * Day, city, type: EventType.Hackathon);
        await factory.AddEventAsync("Advent Build Night", 40 * Day, city, format: EventFormat.Online);
        await factory.AddEventAsync("Spring hackathon", -200 * Day, city, type: EventType.Hackathon);
        await factory.AddEventAsync("Last week's prayer", -7 * Day, city, type: EventType.PrayerAndPlanning, format: EventFormat.Online);
        var member = await factory.AddMemberAsync("Leah Thompson");

        var list = await factory.ClientFor(member).GetFromJsonAsync<EventListResponse>($"/api/events?city={city}{query}");

        Assert.Equal(expected, list!.Events.Select(e => e.Title));
    }

    [Fact]
    public async Task The_city_filter_ignores_case_and_spaces_and_cities_list_every_event_city()
    {
        var city = UniqueCity();
        var other = UniqueCity();
        await factory.AddEventAsync("Builders Night", 5 * Day, city);
        await factory.AddEventAsync("Elsewhere", 5 * Day, other);
        await factory.AddEventAsync("Old one", -50 * Day, other);
        var member = await factory.AddMemberAsync("Leah Thompson");
        var client = factory.ClientFor(member);

        var list = await client.GetFromJsonAsync<EventListResponse>($"/api/events?city=%20{city.ToLowerInvariant()}%20");

        Assert.Equal(["Builders Night"], list!.Events.Select(e => e.Title));
        Assert.Contains(city, list.Cities);
        Assert.Single(list.Cities, c => c == other);
        Assert.Equal(list.Cities.Order(StringComparer.OrdinalIgnoreCase), list.Cities);
    }

    [Theory]
    [InlineData("Staff")]
    [InlineData("7")]
    public async Task Unknown_filter_is_400(string filter)
    {
        var member = await factory.AddMemberAsync("Leah Thompson");

        var response = await factory.ClientFor(member).GetAsync($"/api/events?filter={filter}");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    // AC3 is the page's empty state: the API answers an empty list.
    [Fact]
    public async Task No_matching_events_is_an_empty_list()
    {
        var member = await factory.AddMemberAsync("Leah Thompson");

        var list = await factory.ClientFor(member).GetFromJsonAsync<EventListResponse>($"/api/events?city={UniqueCity()}");

        Assert.Empty(list!.Events);
    }

    // AC4: Given a cancelled event, when it is listed, then it is clearly marked as cancelled.
    [Fact]
    public async Task A_cancelled_event_is_listed_and_flagged_as_cancelled()
    {
        var city = UniqueCity();
        await factory.AddEventAsync("Faith & AI Panel", 3 * Day, city, cancelledBecause: "The venue flooded.");
        await factory.AddEventAsync("Builders Night", 5 * Day, city);
        var member = await factory.AddMemberAsync("Leah Thompson");

        var list = await factory.ClientFor(member).GetFromJsonAsync<EventListResponse>($"/api/events?city={city}");

        Assert.Equal([true, false], list!.Events.Select(e => e.IsCancelled));
    }

    private static string UniqueCity() => $"City{Guid.NewGuid():N}"[..14];

    public sealed record EventSummaryResponse(
        Guid Id,
        string Title,
        string Type,
        DateTimeOffset StartsAt,
        DateTimeOffset EndsAt,
        string City,
        string Format,
        string? Venue,
        string Visibility,
        int RsvpCount,
        bool IsCancelled);

    public sealed record EventListResponse(EventSummaryResponse[] Events, string[] Cities);
}
