// Traces to: L2-172 AC1 to AC6; L2-173 AC1; L2-174 AC1; L2-176 AC1, AC2; L2-177 AC1; L2-178 AC1; L2-179 AC1, AC2; L2-180 AC1, AC2; L2-181 AC1; L2-182 AC1
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FaithTech.Community.Api.Tests.Organisations;
using FaithTech.Community.Api.Tests.Organisations.Isolation;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Events;
using FaithTech.Community.Domain.Organisations;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Events;

// The ten optional kinds (ADR 0042): a hub holds them only when its starting point brings them.
public class HackathonSectionTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    private static readonly string[] Core = ["Hero", "Agenda", "Venue", "People", "Links", "Giving", "UpcomingEvents"];

    private static readonly string[] Catalogue =
    [
        "Hero", "Agenda", "Venue", "Parking", "WhatToBring", "Partners", "Tracks", "Process", "Rules", "People", "Links",
        "DemoFormat", "Judging", "Worship", "Slides", "Giving", "UpcomingEvents",
    ];

    private static readonly string[] Optional = [.. Catalogue.Except(Core)];

    private static string Hub(Guid eventId) => $"/api/events/{eventId}/hub";

    private static string Section(Guid eventId, string kind) => $"{Hub(eventId)}/sections/{kind}";

    private async Task<HttpClient> LeadAsync() =>
        factory.ClientWithCapabilities(await factory.AddMemberAsync("Grace Okonkwo"), Capability.ManageEventHubs);

    /// <summary>A template of the test's own, naming every optional kind, shown and empty.</summary>
    private async Task<Guid> EveryKindTemplateAsync()
    {
        var id = Guid.NewGuid();
        var sections = JsonSerializer.Serialize(Catalogue.Select(k => new { kind = k, visible = true }));
        await factory.WithDbAsync(async db =>
        {
            db.HubTemplates.Add(new HubTemplate(id, $"Every kind {id:N}"[..20], "All seventeen.", 99, sections));
            return await db.SaveChangesAsync();
        });
        return id;
    }

    /// <summary>An event with a hub started from a template naming every kind, and its lead.</summary>
    private async Task<(Guid EventId, HttpClient Lead)> HackathonHubAsync()
    {
        var lead = await LeadAsync();
        var e = await factory.AddEventAsync("SoCal Hackathon", TimeSpan.FromDays(7));
        Assert.Equal(HttpStatusCode.Created, (await lead.PostAsync(Hub(e.Id), null)).StatusCode);
        Assert.Equal(HttpStatusCode.OK,
            (await lead.PostAsJsonAsync($"{Hub(e.Id)}/start", new { templateId = await EveryKindTemplateAsync() })).StatusCode);
        return (e.Id, lead);
    }

    private static async Task<JsonElement[]> SectionsOf(HttpClient client, Guid eventId) =>
        [.. (await client.GetFromJsonAsync<JsonElement>(Hub(eventId))).GetProperty("sections").EnumerateArray()];

    private static async Task<JsonElement> SectionOf(HttpClient client, Guid eventId, string kind) =>
        (await SectionsOf(client, eventId)).Single(s => s.GetProperty("kind").GetString() == kind);

    private static async Task<IDictionary<string, string[]>> ErrorsOf(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        return body.GetProperty("errors").EnumerateObject()
            .ToDictionary(p => p.Name, p => p.Value.EnumerateArray().Select(v => v.GetString()!).ToArray(), StringComparer.OrdinalIgnoreCase);
    }

    // L2-172 AC1, AC2: Blank holds the core seven; a template naming every kind holds all seventeen in catalogue order.
    [Fact]
    public async Task Blank_holds_the_core_kinds_and_a_template_brings_the_optional_ones_in_catalogue_order()
    {
        var lead = await LeadAsync();
        var blank = await factory.AddEventAsync("Prayer Night", TimeSpan.FromDays(5));
        Assert.Equal(HttpStatusCode.Created, (await lead.PostAsync(Hub(blank.Id), null)).StatusCode);
        Assert.Equal(Core, (await SectionsOf(lead, blank.Id)).Select(s => s.GetProperty("kind").GetString()));

        var (eventId, hackathonLead) = await HackathonHubAsync();

        var sections = await SectionsOf(hackathonLead, eventId);
        Assert.Equal(Catalogue, sections.Select(s => s.GetProperty("kind").GetString()));
        Assert.All(sections.Where(s => Optional.Contains(s.GetProperty("kind").GetString())),
            s => Assert.Equal("NeedsInfo", s.GetProperty("state").GetString()));
    }

    // L2-172 AC3: applying Blank afterwards removes the optional sections and their content.
    [Fact]
    public async Task Applying_blank_again_removes_the_optional_sections()
    {
        var (eventId, lead) = await HackathonHubAsync();
        Assert.Equal(HttpStatusCode.NoContent,
            (await lead.PutAsJsonAsync(Section(eventId, "Rules"), new { rules = new[] { new { title = "Start fresh" } } })).StatusCode);

        Assert.Equal(HttpStatusCode.OK, (await lead.PostAsJsonAsync($"{Hub(eventId)}/start", new { })).StatusCode);

        Assert.Equal(Core, (await SectionsOf(lead, eventId)).Select(s => s.GetProperty("kind").GetString()));
        var hubId = await factory.WithDbAsync(db => db.EventHubs.Where(h => h.EventId == eventId).Select(h => h.Id).SingleAsync());
        Assert.False(await factory.WithDbAsync(db =>
            db.Set<HubSection>().IgnoreQueryFilters().AnyAsync(s => s.EventHubId == hubId && s.Kind == HubSectionKind.Rules)));
    }

    // L2-172 AC4: a kind the hub doesn't hold is 404 to save; a reorder must name exactly the hub's kinds.
    [Fact]
    public async Task A_kind_the_hub_does_not_hold_is_404_and_a_reorder_names_exactly_the_hubs_kinds()
    {
        var lead = await LeadAsync();
        var e = await factory.AddEventAsync("Prayer Night", TimeSpan.FromDays(5));
        Assert.Equal(HttpStatusCode.Created, (await lead.PostAsync(Hub(e.Id), null)).StatusCode);

        Assert.Equal(HttpStatusCode.NotFound,
            (await lead.PutAsJsonAsync(Section(e.Id, "Rules"), new { rules = new[] { new { title = "Start fresh" } } })).StatusCode);
        Assert.Contains("Choose sections from the list.",
            (await ErrorsOf(await lead.PutAsJsonAsync($"{Hub(e.Id)}/sections/order", new { kinds = Catalogue })))["kinds"]);

        var (eventId, hackathonLead) = await HackathonHubAsync();
        Assert.Contains("Choose sections from the list.",
            (await ErrorsOf(await hackathonLead.PutAsJsonAsync($"{Hub(eventId)}/sections/order", new { kinds = Core })))["kinds"]);
        var reversed = Catalogue.Reverse().ToArray();
        Assert.Equal(HttpStatusCode.NoContent,
            (await hackathonLead.PutAsJsonAsync($"{Hub(eventId)}/sections/order", new { kinds = reversed })).StatusCode);
        Assert.Equal(reversed, (await SectionsOf(hackathonLead, eventId)).Select(s => s.GetProperty("kind").GetString()));
    }

    // L2-172 AC5, and each kind's shape: one item makes the section Ready, and the content reads back as saved.
    public static TheoryData<string, string, string> ReadyContent => new()
    {
        { "Parking", """{"note":"Park on site first.","options":[{"title":"On site","notes":"75 spots."}]}""", "options" },
        { "WhatToBring", """{"bring":["Your laptop and charger"],"onTheDay":[{"title":"Raise a hand","detail":"Mentors walk the floor."}]}""", "bring" },
        { "Tracks", """{"tracks":[{"title":"Mobile-first church onboarding","brief":"How might we…","linkUrl":"https://github.com/example/challenge","linkText":"Track 1 brief","primary":true}],"goodLooksLike":[{"title":"In their language","detail":"A pastor registers in their language."}]}""", "tracks" },
        { "Process", """{"name":"The Create Cycle","intro":"Every team moves through four movements.","stages":[{"title":"Lament","when":"10:30 to 11:00","summary":"We refuse to rush past pain.","points":[{"title":"Listen","detail":"Whose pain have you heard?"}]}]}""", "stages" },
        { "Rules", """{"rules":[{"title":"Start fresh","detail":"The code starts today."}],"note":"Use a public repo."}""", "rules" },
        { "DemoFormat", """{"minutes":3,"questionMinutes":2,"segments":[{"title":"Your track","detail":"Who it's for.","seconds":30},{"title":"Tend","detail":"Show it working, live.","seconds":90}],"tips":["Demo on a phone"]}""", "segments" },
        { "Judging", """{"topScore":5,"criteria":[{"title":"Redemptive potential","question":"Could this advance the gospel?","topMark":"Real people could meet Jesus through it.","weight":40},{"title":"Usable","weight":30},{"title":"Technical viability","weight":30}],"honors":[{"title":"Most Redemptive","line":"Ready for impact.","chosenBy":"TopScore"}],"note":"Bags of coffee."}""", "criteria" },
        { "Worship", """{"note":"Three songs.","songs":[{"title":"Holy Forever","artist":"Chris Tomlin","url":"https://example.org/holy-forever"}]}""", "songs" },
    };

    [Theory]
    [MemberData(nameof(ReadyContent))]
    public async Task One_item_makes_an_optional_section_ready_and_its_content_reads_back(string kind, string json, string list)
    {
        var (eventId, lead) = await HackathonHubAsync();

        var response = await lead.PutAsync(Section(eventId, kind), new StringContent(json, System.Text.Encoding.UTF8, "application/json"));

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var section = await SectionOf(lead, eventId, kind);
        Assert.Equal("Ready", section.GetProperty("state").GetString());
        Assert.Equal(JsonDocument.Parse(json).RootElement.GetProperty(list).GetArrayLength(),
            section.GetProperty("content").GetProperty(list).GetArrayLength());
    }

    // Validation per kind: required fields, limits and the two totals, each on its field.
    public static TheoryData<string, string, string, string> Invalid => new()
    {
        { "Parking", """{"options":[{"title":" "}]}""", "options[0].title", "Name this option." },
        { "Parking", """{"note":"__301__"}""", "note", "Use 300 characters or fewer." },
        { "Parking", """{"options":__7_TITLED__}""", "options", "You can add up to 6 options." },
        { "WhatToBring", """{"bring":[" "]}""", "bring[0]", "Say what to bring." },
        { "WhatToBring", """{"onTheDay":[{"title":""}]}""", "onTheDay[0].title", "Give this a title." },
        { "Partners", """{"partnerIds":__7_IDS__}""", "partnerIds", "You can pick up to 6 partners." },
        { "Tracks", """{"tracks":[{"title":"","brief":"A brief."}]}""", "tracks[0].title", "Name this track." },
        { "Tracks", """{"tracks":[{"title":"One","brief":" "}]}""", "tracks[0].brief", "Add the track’s brief." },
        { "Tracks", """{"tracks":[{"title":"One","brief":"A.","primary":true},{"title":"Two","brief":"B.","primary":true}]}""", "tracks", "Mark one track as primary." },
        { "Tracks", """{"tracks":[{"title":"One","brief":"A.","linkUrl":"http://example.org"}]}""", "tracks[0].linkUrl", "Use a link that starts with https://" },
        { "Process", """{"stages":[{"title":""}]}""", "stages[0].title", "Name this stage." },
        { "Rules", """{"rules":[{"title":" "}]}""", "rules[0].title", "Name this rule." },
        { "Rules", """{"rules":__13_TITLED__}""", "rules", "You can add up to 12 rules." },
        { "DemoFormat", """{"minutes":31}""", "minutes", "Choose between 1 and 30 minutes." },
        { "DemoFormat", """{"minutes":3,"segments":[{"title":"Track","seconds":120},{"title":"Tend","seconds":90}]}""", "segments", "The segments run 3:30. Make them fit in 3 minutes." },
        { "Judging", """{"criteria":[{"title":"Redemptive","weight":40},{"title":"Usable","weight":30},{"title":"Viable","weight":20}]}""", "criteria", "Weights add up to 90%. Make them total 100%." },
        { "Judging", """{"honors":[{"title":"Most Creative","chosenBy":"Coin toss"}]}""", "honors[0].chosenBy", "Choose how it’s chosen." },
        { "Worship", """{"songs":[{"title":""}]}""", "songs[0].title", "Name the song." },
        { "Worship", """{"songs":[{"title":"Holy Forever","url":"ftp://example.org"}]}""", "songs[0].url", "Use a link that starts with https://" },
        { "Slides", """{"slides":__61_SLIDES__}""", "slides", "You can add up to 60 slides." },
    };

    [Theory]
    [MemberData(nameof(Invalid))]
    public async Task Invalid_content_is_refused_on_its_field_and_nothing_changes(string kind, string json, string field, string message)
    {
        var (eventId, lead) = await HackathonHubAsync();
        json = json
            .Replace("__301__", new string('a', 301))
            .Replace("__7_TITLED__", Titled(7)).Replace("__13_TITLED__", Titled(13))
            .Replace("__7_IDS__", JsonSerializer.Serialize(Enumerable.Range(0, 7).Select(_ => Guid.NewGuid())))
            .Replace("__61_SLIDES__", JsonSerializer.Serialize(Enumerable.Range(0, 61).Select(_ => new { resourceId = Guid.NewGuid() })));

        var errors = await ErrorsOf(await lead.PutAsync(Section(eventId, kind), new StringContent(json, System.Text.Encoding.UTF8, "application/json")));

        Assert.Contains(message, errors[field]);
        Assert.Equal("NeedsInfo", (await SectionOf(lead, eventId, kind)).GetProperty("state").GetString());
    }

    private static string Titled(int count) => JsonSerializer.Serialize(Enumerable.Range(1, count).Select(i => new { title = $"Item {i}" }));

    // L2-172 AC6: 403 without the capability; another organisation's hub is 404; an override is audited.
    [Fact]
    public async Task Optional_sections_need_the_capability_stay_in_the_organisation_and_audit_an_override()
    {
        var (eventId, _) = await HackathonHubAsync();
        var member = factory.ClientWithCapabilities(await factory.AddMemberAsync("Jonah Bell"), Capability.ManageEvents);
        var rules = new { rules = new[] { new { title = "Start fresh" } } };

        Assert.Equal(HttpStatusCode.Forbidden, (await member.PutAsJsonAsync(Section(eventId, "Rules"), rules)).StatusCode);
        var northside = await factory.NorthsideClientAsync(Role.EventLead);
        Assert.Equal(HttpStatusCode.NotFound, (await northside.PutAsJsonAsync(Section(eventId, "Rules"), rules)).StatusCode);

        var admin = await factory.FaithTechAdminAsync();
        Assert.Equal(HttpStatusCode.NoContent, (await admin.PutAsJsonAsync(Section(eventId, "Rules"), rules)).StatusCode);
        Assert.True(await factory.WithDbAsync(db => db.AuditEntries.AnyAsync(a =>
            a.Action == "event_hub.updated" && a.AfterJson!.Contains("Rules"))));
    }
}
