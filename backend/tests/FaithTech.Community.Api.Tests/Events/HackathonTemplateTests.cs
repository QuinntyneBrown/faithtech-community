// Traces to: L2-183 AC1, AC2
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Organisations;

namespace FaithTech.Community.Api.Tests.Events;

// FaithTech's Hackathon template is the regression case for the hackathon sections' defaults (seed data, never named in code).
public class HackathonTemplateTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    private static string Hub(Guid eventId) => $"/api/events/{eventId}/hub";

    private static async Task<JsonElement> StartAsync(HttpClient lead, Guid eventId, string template)
    {
        var id = (await lead.GetFromJsonAsync<JsonElement[]>("/api/event-hubs/templates"))!
            .Single(t => t.GetProperty("name").GetString() == template).GetProperty("id").GetString();
        var response = await lead.PostAsJsonAsync($"{Hub(eventId)}/start", new { templateId = id });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }

    // L2-183 AC2: all seventeen sections; the five defaulted ones Ready, the five event-specific ones Needs info.
    [Fact]
    public async Task A_hub_started_from_hackathon_holds_every_section_with_the_defaults_ready()
    {
        var lead = factory.ClientWithCapabilities(await factory.AddMemberAsync("Grace Okonkwo"), Capability.ManageEventHubs);
        var e = await factory.AddEventAsync("SoCal Hackathon", TimeSpan.FromDays(7));
        Assert.Equal(HttpStatusCode.Created, (await lead.PostAsync(Hub(e.Id), null)).StatusCode);

        var hub = await StartAsync(lead, e.Id, "Hackathon");

        var states = hub.GetProperty("sections").EnumerateArray()
            .ToDictionary(s => s.GetProperty("kind").GetString()!, s => s.GetProperty("state").GetString());
        Assert.Equal(17, states.Count);
        Assert.All(new[] { "WhatToBring", "Process", "Rules", "DemoFormat", "Judging" }, k => Assert.Equal("Ready", states[k]));
        Assert.All(new[] { "Parking", "Partners", "Tracks", "Worship", "Slides" }, k => Assert.Equal("NeedsInfo", states[k]));

        JsonElement Content(string kind) => hub.GetProperty("sections").EnumerateArray()
            .Single(s => s.GetProperty("kind").GetString() == kind).GetProperty("content");
        Assert.Equal(["Lament", "Discern", "Build", "Steward"],
            Content("Process").GetProperty("stages").EnumerateArray().Select(s => s.GetProperty("title").GetString()));
        Assert.Equal(6, Content("Rules").GetProperty("rules").GetArrayLength());
        Assert.Equal(100, Content("Judging").GetProperty("criteria").EnumerateArray().Sum(c => c.GetProperty("weight").GetInt32()));
        Assert.Equal(["TopScore", "MentorsPick", "JudgesPick"],
            Content("Judging").GetProperty("honors").EnumerateArray().Select(h => h.GetProperty("chosenBy").GetString()));
        Assert.Equal(3, Content("DemoFormat").GetProperty("minutes").GetInt32());
        Assert.Equal(180, Content("DemoFormat").GetProperty("segments").EnumerateArray().Sum(s => s.GetProperty("seconds").GetInt32()));

        // L2-183 AC1: Meetup brings no optional kind.
        var meetup = await StartAsync(lead, e.Id, "Meetup");
        Assert.Equal(7, meetup.GetProperty("sections").GetArrayLength());
    }
}
