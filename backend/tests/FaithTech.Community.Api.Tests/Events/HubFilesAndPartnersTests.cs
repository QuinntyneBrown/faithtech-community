// Traces to: L2-173 AC2, AC3; L2-175 AC2, AC3; L2-182 AC2, AC3
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FaithTech.Community.Api.Tests.Organisations;
using FaithTech.Community.Api.Tests.Organisations.Isolation;
using FaithTech.Community.Api.Tests.Partners;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Api.Tests.Resources;
using FaithTech.Community.Domain.Events;
using FaithTech.Community.Domain.Organisations;
using FaithTech.Community.Domain.Profiles;

namespace FaithTech.Community.Api.Tests.Events;

// Partners are read live from Partners; maps and slides are Resources served through the hub (ADR 0042).
public class HubFilesAndPartnersTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    private static string Hub(Guid eventId) => $"/api/events/{eventId}/hub";

    private static string Section(Guid eventId, string kind) => $"{Hub(eventId)}/sections/{kind}";

    private static string File(Guid eventId, Guid resourceId) => $"{Hub(eventId)}/files/{resourceId}";

    /// <summary>A public event with a hub holding every kind, its lead (also a City Lead, so they can add partners and files).</summary>
    private async Task<(Guid EventId, HttpClient Lead, ProfileClients.Member Member)> HubAsync(EventVisibility visibility = EventVisibility.Public)
    {
        var member = await factory.AddMemberAsync("Grace Okonkwo");
        var lead = factory.ClientFor(member, Role.CityLead);
        var e = await factory.AddEventAsync("SoCal Hackathon", TimeSpan.FromDays(7), visibility: visibility);
        Assert.Equal(HttpStatusCode.Created, (await lead.PostAsync(Hub(e.Id), null)).StatusCode);
        var template = Guid.NewGuid();
        var kinds = new[]
        {
            "Hero", "Agenda", "Venue", "Parking", "WhatToBring", "Partners", "Tracks", "Process", "Rules", "People", "Links",
            "DemoFormat", "Judging", "Worship", "Slides", "Giving", "UpcomingEvents",
        };
        await factory.WithDbAsync(async db =>
        {
            db.HubTemplates.Add(new HubTemplate(template, $"Files {template:N}"[..20], "Every kind.", 98,
                JsonSerializer.Serialize(kinds.Select(k => new { kind = k, visible = true }))));
            return await db.SaveChangesAsync();
        });
        Assert.Equal(HttpStatusCode.OK, (await lead.PostAsJsonAsync($"{Hub(e.Id)}/start", new { templateId = template })).StatusCode);
        return (e.Id, lead, member);
    }

    private async Task<Guid> ResourceAsync(ProfileClients.Member owner, ResourceClients.Upload file) =>
        (await factory.AddFileAsync(owner, file)).Id;

    private static ResourceClients.Upload Map(string name = "lot-map.jpg") => new(name, TestImages.Jpeg());

    private static ResourceClients.Upload Deck(string name = "slides.pdf") => new(name, ResourceClients.Pdf);

    private static async Task<JsonElement> ContentOf(HttpClient client, Guid eventId, string kind) =>
        (await client.GetFromJsonAsync<JsonElement>(Hub(eventId))).GetProperty("sections").EnumerateArray()
            .Single(s => s.GetProperty("kind").GetString() == kind).GetProperty("content");

    private static async Task<IDictionary<string, string[]>> ErrorsOf(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("errors").EnumerateObject()
            .ToDictionary(p => p.Name, p => p.Value.EnumerateArray().Select(v => v.GetString()!).ToArray(), StringComparer.OrdinalIgnoreCase);
    }

    // L2-175 AC2, AC3: partners of the organisation are read live; another organisation's partner is refused.
    [Fact]
    public async Task Partners_are_read_live_and_must_be_the_organisations()
    {
        var (eventId, lead, member) = await HubAsync();
        var partner = await factory.AddPartnerAsync(member, "Baptize The World", "https://baptizetheworld.example.org");
        var duplicate = await factory.AddPartnerAsync(member, "Baptize the World Inc", null);
        var northside = await factory.NorthsideClientAsync(Role.CityLead);
        var theirs = (await (await northside.PostAsJsonAsync("/api/partners", new { Name = Isolation.Marker() }))
            .Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();

        var refused = await lead.PutAsJsonAsync(Section(eventId, "Partners"), new { partnerIds = new[] { theirs } });
        Assert.Contains("Choose a partner from the list.", (await ErrorsOf(refused))["partnerIds"]);

        Assert.Equal(HttpStatusCode.NoContent, (await lead.PutAsJsonAsync(Section(eventId, "Partners"),
            new { partnerIds = new[] { partner.Id }, meet = "A global movement uniting churches in baptism." })).StatusCode);
        var content = await ContentOf(lead, eventId, "Partners");
        var shown = Assert.Single(content.GetProperty("partners").EnumerateArray());
        Assert.Equal("Baptize The World", shown.GetProperty("name").GetString());
        Assert.Equal("https://baptizetheworld.example.org", shown.GetProperty("website").GetString());
        Assert.Equal("A global movement uniting churches in baptism.", content.GetProperty("meet").GetString());

        // A partner merged away is archived by the merge (ADR 0028), so the hub leaves it out.
        Assert.Equal(HttpStatusCode.NoContent, (await lead.PutAsJsonAsync(Section(eventId, "Partners"),
            new { partnerIds = new[] { partner.Id, duplicate.Id } })).StatusCode);
        Assert.True((await lead.MergeAsync(partner.Id, PartnerClients.MergeBody(partner, duplicate))).IsSuccessStatusCode);
        Assert.Equal(["Baptize The World"], (await ContentOf(lead, eventId, "Partners")).GetProperty("partners").EnumerateArray()
            .Select(p => p.GetProperty("name").GetString()));
    }

    // L2-173 AC2, L2-182 AC2: a map must be an image and a slide a PDF or an image of the organisation; reads name them.
    [Fact]
    public async Task Maps_must_be_images_and_slides_pdfs_or_images_and_both_read_with_their_titles()
    {
        var (eventId, lead, member) = await HubAsync();
        var map = await ResourceAsync(member, Map());
        var pdf = await ResourceAsync(member, Deck());
        var deck = await ResourceAsync(member, ResourceClients.Deck());

        var badMap = await lead.PutAsJsonAsync(Section(eventId, "Parking"), new { options = new[] { new { title = "On site", mapResourceId = pdf } } });
        Assert.Contains("Choose an image.", (await ErrorsOf(badMap))["options[0].mapResourceId"]);
        var badSlide = await lead.PutAsJsonAsync(Section(eventId, "Slides"), new { slides = new[] { new { resourceId = deck } } });
        Assert.Contains("Choose a PDF or an image.", (await ErrorsOf(badSlide))["slides[0].resourceId"]);
        var unknown = await lead.PutAsJsonAsync(Section(eventId, "Slides"), new { slides = new[] { new { resourceId = Guid.NewGuid() } } });
        Assert.Contains("Choose a PDF or an image.", (await ErrorsOf(unknown))["slides[0].resourceId"]);

        Assert.Equal(HttpStatusCode.NoContent, (await lead.PutAsJsonAsync(Section(eventId, "Parking"),
            new { options = new[] { new { title = "On site", notes = "75 spots.", mapResourceId = map } } })).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await lead.PutAsJsonAsync(Section(eventId, "Slides"),
            new { slides = new[] { new { resourceId = map }, new { resourceId = pdf } } })).StatusCode);

        var option = (await ContentOf(lead, eventId, "Parking")).GetProperty("options")[0];
        Assert.Equal(map, option.GetProperty("mapResourceId").GetGuid());
        Assert.Equal("lot-map", option.GetProperty("mapTitle").GetString());
        var slides = (await ContentOf(lead, eventId, "Slides")).GetProperty("slides").EnumerateArray().ToArray();
        Assert.Equal([("Image", map), ("Pdf", pdf)], slides.Select(s => (s.GetProperty("kind").GetString(), s.GetProperty("resourceId").GetGuid())));
    }

    // L2-182 AC3: a file is served only for a resource a shown section names, to whoever may see the hub page.
    [Fact]
    public async Task Hub_files_are_served_only_for_shown_sections_to_those_who_may_see_the_page()
    {
        var (eventId, lead, member) = await HubAsync();
        var map = await ResourceAsync(member, Map());
        var pdf = await ResourceAsync(member, Deck());
        var elsewhere = await ResourceAsync(member, Map("not-on-the-hub.jpg"));
        Assert.Equal(HttpStatusCode.NoContent, (await lead.PutAsJsonAsync(Section(eventId, "Parking"),
            new { options = new[] { new { title = "On site", mapResourceId = map } } })).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await lead.PutAsJsonAsync(Section(eventId, "Slides"),
            new { slides = new[] { new { resourceId = pdf } } })).StatusCode);
        var anonymous = factory.CreateClient();

        Assert.Equal(HttpStatusCode.OK, (await lead.GetAsync(File(eventId, map))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await anonymous.GetAsync(File(eventId, map))).StatusCode);

        Assert.Equal(HttpStatusCode.NoContent, (await lead.PostAsync($"{Hub(eventId)}/publish", null)).StatusCode);
        var file = await anonymous.GetAsync(File(eventId, map));
        Assert.Equal(HttpStatusCode.OK, file.StatusCode);
        Assert.Equal("image/jpeg", file.Content.Headers.ContentType!.MediaType);
        Assert.Equal(HttpStatusCode.OK, (await anonymous.GetAsync($"{File(eventId, map)}/thumbnail")).StatusCode);
        Assert.Equal("application/pdf", (await anonymous.GetAsync(File(eventId, pdf))).Content.Headers.ContentType!.MediaType);
        Assert.Equal(HttpStatusCode.NotFound, (await anonymous.GetAsync(File(eventId, elsewhere))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await (await factory.NorthsideClientAsync(Role.CityLead)).GetAsync(File(eventId, map))).StatusCode);

        Assert.Equal(HttpStatusCode.NoContent, (await lead.PutAsJsonAsync(Hub(eventId), new { sections = new[] { new { kind = "Parking", visible = false } } })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await anonymous.GetAsync(File(eventId, map))).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await anonymous.GetAsync(File(eventId, pdf))).StatusCode);
    }

    // L2-182 AC3: a members-only event's published hub serves files to members, not to anonymous visitors.
    [Fact]
    public async Task A_members_only_hubs_files_are_for_members()
    {
        var (eventId, lead, member) = await HubAsync(EventVisibility.MembersOnly);
        var map = await ResourceAsync(member, Map());
        Assert.Equal(HttpStatusCode.NoContent, (await lead.PutAsJsonAsync(Section(eventId, "Parking"),
            new { options = new[] { new { title = "On site", mapResourceId = map } } })).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await lead.PostAsync($"{Hub(eventId)}/publish", null)).StatusCode);
        var reader = factory.ClientWithCapabilities(await factory.AddMemberAsync("Ruth Alvarez"));

        Assert.Equal(HttpStatusCode.NotFound, (await factory.CreateClient().GetAsync(File(eventId, map))).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await reader.GetAsync(File(eventId, map))).StatusCode);
    }
}
