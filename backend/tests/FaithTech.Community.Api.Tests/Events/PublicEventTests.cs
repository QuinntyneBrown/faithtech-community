// Traces to: L2-023
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using FaithTech.Community.Domain.Events;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Events;

public partial class PublicEventTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    private static readonly TimeSpan Week = TimeSpan.FromDays(7);

    // AC1: Given a public event, when an anonymous visitor opens its share link, then they see the event without signing in.
    [Fact]
    public async Task An_anonymous_visitor_sees_a_public_event()
    {
        var existing = await factory.AddEventAsync("Toronto Builders Night", Week, visibility: EventVisibility.Public, rsvps: 3, capacity: 40);

        var response = await factory.CreateClient().GetAsync($"/api/public/events/{existing.Id}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Toronto Builders Night", json.GetProperty("title").GetString());
        Assert.Equal("About Toronto Builders Night.", json.GetProperty("description").GetString());
        Assert.Equal(existing.StartsAt, json.GetProperty("startsAt").GetDateTimeOffset());
        Assert.Equal("Toronto", json.GetProperty("chapterName").GetString());
        Assert.Equal("Kestrel Labs, 220 King St W", json.GetProperty("venue").GetString());
        Assert.Equal(3, json.GetProperty("rsvpCount").GetInt32());
        Assert.False(json.GetProperty("isFull").GetBoolean());
        Assert.False(json.GetProperty("isCancelled").GetBoolean());
        Assert.False(json.TryGetProperty("rsvps", out _));
    }

    [Fact]
    public async Task The_joining_link_of_an_online_event_is_kept_for_people_who_rsvp()
    {
        var existing = await factory.AddEventAsync("Prayer & Planning", Week, format: EventFormat.Online, visibility: EventVisibility.Public);

        var json = await factory.CreateClient().GetFromJsonAsync<JsonElement>($"/api/public/events/{existing.Id}");

        Assert.Equal("Online", json.GetProperty("format").GetString());
        Assert.DoesNotContain("meet.example.org", json.GetRawText());
    }

    // AC3: Given a members-only event, when an anonymous visitor requests it, then they are redirected to sign in.
    // The API answers 404 for a members-only or unknown event; the web app sends the visitor to sign in.
    [Fact]
    public async Task A_members_only_or_unknown_event_is_404_on_the_public_api()
    {
        var membersOnly = await factory.AddEventAsync("City Team Prayer", Week, visibility: EventVisibility.MembersOnly);
        var client = factory.CreateClient();

        var hidden = await client.GetAsync($"/api/public/events/{membersOnly.Id}");
        var unknown = await client.GetAsync($"/api/public/events/{Guid.NewGuid()}");
        var rsvp = await client.PostAsJsonAsync($"/api/public/events/{membersOnly.Id}/rsvps", new { name = "Abby Brooks", email = "abby@example.org" });

        Assert.Equal(HttpStatusCode.NotFound, hidden.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, unknown.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, rsvp.StatusCode);
    }

    // AC2: Given a guest, when they RSVP with a name and a valid email, then a confirmation email with the .ics is
    // sent and no account is created.
    [Fact]
    public async Task A_guest_rsvps_gets_a_confirmation_with_the_ics_and_no_account()
    {
        var existing = await factory.AddEventAsync("Toronto Builders Night", Week, visibility: EventVisibility.Public);
        var email = $"{Guid.NewGuid():N}@example.org";
        var users = await factory.WithDbAsync(db => db.Users.CountAsync());

        var response = await factory.CreateClient().PostAsJsonAsync($"/api/public/events/{existing.Id}/rsvps", new { name = " Abby Brooks ", email });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var rsvp = Assert.Single((await factory.LoadEventAsync(existing.Id)).Rsvps);
        Assert.Equal(("Abby Brooks", email, (Guid?)null), (rsvp.GuestName, rsvp.GuestEmail, rsvp.ProfileId));
        Assert.Equal(users, await factory.WithDbAsync(db => db.Users.CountAsync()));
        var sent = Assert.Single(await factory.QueuedEmailsToAsync(email));
        Assert.Equal("You’re going to Toronto Builders Night", sent.Subject);
        Assert.Matches(CancelLink(), sent.Body);
        var ics = Assert.Single(sent.Attachments!);
        Assert.Contains($"UID:{existing.Id}@faithtech.community", ics.Content);
    }

    [Theory]
    [InlineData("", "abby@example.org", "Name", "Enter your name so the host knows who’s coming.")]
    [InlineData("Abby Brooks", "abby.brooks@", "Email", "Enter an email like name@example.org.")]
    public async Task A_guest_rsvp_needs_a_name_and_a_valid_email(string name, string email, string field, string message)
    {
        var existing = await factory.AddEventAsync("Toronto Builders Night", Week, visibility: EventVisibility.Public);

        var response = await factory.CreateClient().PostAsJsonAsync($"/api/public/events/{existing.Id}/rsvps", new { name, email });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var errors = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("errors");
        Assert.Equal(message, errors.GetProperty(field)[0].GetString());
    }

    // AC5: Given the same email, when a guest RSVPs to the same event twice, then a single RSVP is kept.
    [Fact]
    public async Task The_same_email_twice_keeps_a_single_rsvp()
    {
        var existing = await factory.AddEventAsync("Toronto Builders Night", Week, visibility: EventVisibility.Public);
        var email = $"{Guid.NewGuid():N}@example.org";
        var client = factory.CreateClient();

        await client.PostAsJsonAsync($"/api/public/events/{existing.Id}/rsvps", new { name = "Abby Brooks", email });
        var again = await client.PostAsJsonAsync($"/api/public/events/{existing.Id}/rsvps", new { name = "Abby B", email = email.ToUpperInvariant() });

        Assert.Equal(HttpStatusCode.NoContent, again.StatusCode);
        Assert.Single((await factory.LoadEventAsync(existing.Id)).Rsvps);
    }

    [Fact]
    public async Task A_cancelled_or_full_public_event_refuses_a_guest()
    {
        var cancelled = await factory.AddEventAsync("Panel", Week, visibility: EventVisibility.Public, cancelledBecause: "Venue flooded.");
        var full = await factory.AddEventAsync("Builders Night", Week, visibility: EventVisibility.Public, capacity: 1, rsvps: 1);
        var client = factory.CreateClient();

        var toCancelled = await client.PostAsJsonAsync($"/api/public/events/{cancelled.Id}/rsvps", new { name = "Abby Brooks", email = "abby@example.org" });
        var toFull = await client.PostAsJsonAsync($"/api/public/events/{full.Id}/rsvps", new { name = "Abby Brooks", email = "abby@example.org" });

        Assert.Equal(HttpStatusCode.Conflict, toCancelled.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, toFull.StatusCode);
        Assert.Equal("This event is full.", (await toFull.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("detail").GetString());
    }

    // AC6: Given a guest RSVP, when the guest follows the cancel link in their confirmation email, then their RSVP
    // is cancelled without signing in.
    [Fact]
    public async Task The_cancel_link_cancels_the_guest_rsvp_without_signing_in()
    {
        var existing = await factory.AddEventAsync("Toronto Builders Night", Week, visibility: EventVisibility.Public);
        var email = $"{Guid.NewGuid():N}@example.org";
        var client = factory.CreateClient();
        await client.PostAsJsonAsync($"/api/public/events/{existing.Id}/rsvps", new { name = "Abby Brooks", email });
        var link = CancelLink().Match(Assert.Single(await factory.QueuedEmailsToAsync(email)).Body);
        Assert.Equal(existing.Id.ToString(), link.Groups["id"].Value);

        var cancel = await client.PostAsJsonAsync($"/api/public/events/{existing.Id}/rsvps/cancel", new { token = link.Groups["token"].Value });
        var again = await client.PostAsJsonAsync($"/api/public/events/{existing.Id}/rsvps/cancel", new { token = link.Groups["token"].Value });

        Assert.Equal(HttpStatusCode.NoContent, cancel.StatusCode);
        Assert.Empty((await factory.LoadEventAsync(existing.Id)).Rsvps);
        Assert.Equal(HttpStatusCode.NotFound, again.StatusCode);
    }

    [Fact]
    public async Task A_wrong_cancel_token_changes_nothing()
    {
        var existing = await factory.AddEventAsync("Toronto Builders Night", Week, visibility: EventVisibility.Public);
        var client = factory.CreateClient();
        await client.PostAsJsonAsync($"/api/public/events/{existing.Id}/rsvps", new { name = "Abby Brooks", email = $"{Guid.NewGuid():N}@example.org" });

        var response = await client.PostAsJsonAsync($"/api/public/events/{existing.Id}/rsvps/cancel", new { token = "not-the-token" });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Single((await factory.LoadEventAsync(existing.Id)).Rsvps);
    }

    // AC4: Given more than 10 guest RSVPs from one IP address in an hour, when another is submitted, then it is rejected.
    [Fact]
    public async Task The_eleventh_guest_rsvp_from_one_address_in_an_hour_is_rejected()
    {
        var existing = await factory.AddEventAsync("Toronto Builders Night", Week, visibility: EventVisibility.Public);
        var client = factory.WithWebHostBuilder(b => b.UseSetting("RateLimits:GuestRsvpPerHour", "10")).CreateClient();

        for (var i = 0; i < 10; i++)
        {
            var ok = await client.PostAsJsonAsync($"/api/public/events/{existing.Id}/rsvps", new { name = $"Guest {i}", email = $"guest{i}-{Guid.NewGuid():N}@example.org" });
            Assert.Equal(HttpStatusCode.NoContent, ok.StatusCode);
        }

        var eleventh = await client.PostAsJsonAsync($"/api/public/events/{existing.Id}/rsvps", new { name = "Guest 11", email = "guest11@example.org" });

        Assert.Equal(HttpStatusCode.TooManyRequests, eleventh.StatusCode);
        Assert.Equal(10, (await factory.LoadEventAsync(existing.Id)).Rsvps.Count);
    }

    [GeneratedRegex(@"/public/events/(?<id>[0-9a-f-]{36})/cancel-rsvp\?token=(?<token>[A-Za-z0-9_-]+)")]
    private static partial Regex CancelLink();
}
