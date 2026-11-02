// Traces to: L2-197 AC1, AC2, AC5, AC7; L2-198 AC1 to AC7 (docs/detailed-designs/events/download-hub-archive, ADR 0046)
using System.IO.Compression;
using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using FaithTech.Community.Api.Tests.Organisations.Isolation;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Api.Tests.Resources;
using FaithTech.Community.Domain.Events;
using FaithTech.Community.Domain.Organisations;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Events;

// The archive is the hub as visitors see it, written into a zip on the server, for hub managers only.
public class HubArchiveTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    private const string Folder = "socal-hackathon-hub";

    private static string Hub(Guid eventId) => $"/api/events/{eventId}/hub";

    private static string Archive(Guid eventId, string? timeZone = null) =>
        $"{Hub(eventId)}/archive{(timeZone is null ? string.Empty : $"?timeZone={Uri.EscapeDataString(timeZone)}")}";

    /// <summary>An event a week away with a draft hub holding every kind, and its FaithTech City Lead.</summary>
    private async Task<(Guid EventId, HttpClient Lead, ProfileClients.Member Member)> HubAsync()
    {
        var member = await factory.AddMemberAsync("Grace Okonkwo");
        var lead = factory.ClientFor(member, Role.CityLead);
        var e = await factory.AddEventAsync("SoCal Hackathon", TimeSpan.FromDays(7));
        Assert.Equal(HttpStatusCode.Created, (await lead.PostAsync(Hub(e.Id), null)).StatusCode);
        var template = Guid.NewGuid();
        var kinds = new[]
        {
            "Hero", "Agenda", "Venue", "Parking", "WhatToBring", "Partners", "Tracks", "Process", "Rules", "People", "Links",
            "DemoFormat", "Judging", "Worship", "Slides", "Giving", "UpcomingEvents",
        };
        await factory.WithDbAsync(async db =>
        {
            db.HubTemplates.Add(new HubTemplate(template, $"Archive {template:N}"[..20], "Every kind.", 97,
                JsonSerializer.Serialize(kinds.Select(k => new { kind = k, visible = true }))));
            return await db.SaveChangesAsync();
        });
        Assert.Equal(HttpStatusCode.OK, (await lead.PostAsJsonAsync($"{Hub(e.Id)}/start", new { templateId = template })).StatusCode);
        return (e.Id, lead, member);
    }

    private static async Task Fill(HttpClient lead, Guid eventId, string kind, object content) =>
        Assert.Equal(HttpStatusCode.NoContent, (await lead.PutAsJsonAsync($"{Hub(eventId)}/sections/{kind}", content)).StatusCode);

    private static async Task<Dictionary<string, byte[]>> EntriesAsync(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var zip = new ZipArchive(new MemoryStream(await response.Content.ReadAsByteArrayAsync()), ZipArchiveMode.Read);
        var entries = new Dictionary<string, byte[]>();
        foreach (var entry in zip.Entries)
        {
            using var content = new MemoryStream();
            await entry.Open().CopyToAsync(content);
            entries[entry.FullName] = content.ToArray();
        }

        return entries;
    }

    private static string Page(Dictionary<string, byte[]> entries) => Encoding.UTF8.GetString(entries[$"{Folder}/index.html"]);

    private Task<List<(string Action, string? After)>> ArchiveAuditAsync(Guid eventId) =>
        factory.WithDbAsync(async db =>
        {
            var hubId = (await db.EventHubs.SingleAsync(h => h.EventId == eventId)).Id.ToString();
            return (await db.AuditEntries.AsNoTracking().Where(a => a.TargetId == hubId && a.Action == "event_hub.archived")
                .OrderBy(a => a.OccurredAtUtc).ToListAsync()).Select(a => (a.Action, a.AfterJson)).ToList();
        });

    // L2-198 AC1, L2-197 AC1, AC2, L2-151: FaithTech's City Lead downloads a draft hub as one folder holding the page, the
    // maps, the photos and the slides its shown sections use, and nothing else.
    [Fact]
    public async Task A_city_lead_downloads_the_hub_as_a_zip_of_its_page_maps_photos_and_slides()
    {
        var (eventId, lead, member) = await HubAsync();
        var map = (await factory.AddFileAsync(member, new ResourceClients.Upload("lot-map.jpg", TestImages.Jpeg()))).Id;
        var deck = (await factory.AddFileAsync(member, new ResourceClients.Upload("briefs.pdf", ResourceClients.Pdf))).Id;
        var unused = (await factory.AddFileAsync(member, new ResourceClients.Upload("unused.pdf", ResourceClients.Pdf))).Id;
        var speaker = await factory.AddMemberAsync("Holly Dunlap", p => p.AddPhoto(new ProfilePhoto($"profiles/{p.Id}/holly.jpg", "Holly", DateTimeOffset.UtcNow)));
        factory.Photos.Blobs[$"profiles/{speaker.ProfileId}/holly.jpg"] = ([1, 2, 3], "image/jpeg");
        await Fill(lead, eventId, "Parking", new { options = new[] { new { title = "On-site parking", mapResourceId = map } } });
        await Fill(lead, eventId, "Slides", new { slides = new[] { new { resourceId = map }, new { resourceId = deck } } });
        await Fill(lead, eventId, "People", new { people = new object[] { new { profileId = speaker.ProfileId, role = "Mentor" }, new { name = "Pastor Calin", role = "Judge" } } });

        var response = await lead.GetAsync(Archive(eventId, "America/Los_Angeles"));

        Assert.Equal("application/zip", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal("socal-hackathon-hub.zip", response.Content.Headers.ContentDisposition?.FileNameStar ?? response.Content.Headers.ContentDisposition?.FileName?.Trim('"'));
        var entries = await EntriesAsync(response);
        Assert.Equal(
            new[] { $"{Folder}/index.html", $"{Folder}/slides/01.jpg", $"{Folder}/slides/02.pdf", $"{Folder}/images/parking-1.jpg", $"{Folder}/images/person-1.jpg" }.Order(),
            entries.Keys.Order());
        Assert.Equal(ResourceClients.Pdf, entries[$"{Folder}/slides/02.pdf"]);
        Assert.Equal([1, 2, 3], entries[$"{Folder}/images/person-1.jpg"]);
        var page = Page(entries);
        Assert.Contains("<h1>SoCal Hackathon</h1>", page);
        Assert.Contains("Times are in America/Los_Angeles.", page);
        Assert.Contains("<img src=\"images/parking-1.jpg\" alt=\"Map of On-site parking\">", page);
        Assert.Contains("<a href=\"slides/02.pdf\">2. briefs (PDF)</a>", page);
        Assert.Contains("<img class=\"avatar\" src=\"images/person-1.jpg\" alt=\"\"><div><strong>Holly Dunlap</strong>", page);
        Assert.Contains("<span class=\"avatar\" aria-hidden=\"true\">PC</span><div><strong>Pastor Calin</strong>", page);
        Assert.DoesNotContain(unused.ToString(), page);
        Assert.DoesNotContain(FakesBaseUrl, page);
    }

    private const string FakesBaseUrl = Fakes.FakePhotoStorage.BaseUrl;

    // L2-197 AC5: a hidden section, or one that needs info, is not in the archive, as on the hub page.
    [Fact]
    public async Task Hidden_and_unfinished_sections_are_left_out()
    {
        var (eventId, lead, _) = await HubAsync();
        await Fill(lead, eventId, "Rules", new { rules = new[] { new { title = "Start fresh" } } });
        await Fill(lead, eventId, "Worship", new { songs = new[] { new { title = "Way Maker", artist = "Sinach" } } });
        Assert.Equal(HttpStatusCode.NoContent, (await lead.PutAsJsonAsync(Hub(eventId),
            new { sections = new[] { new { kind = "Worship", visible = false } } })).StatusCode);

        var page = Page(await EntriesAsync(await lead.GetAsync(Archive(eventId))));

        Assert.Contains(">Rules</h2>", page);
        Assert.DoesNotContain(">Worship</h2>", page);
        Assert.DoesNotContain("Way Maker", page);
        Assert.DoesNotContain(">Tracks</h2>", page);
    }

    // L2-197 AC7, L2-198 AC6: no time zone writes UTC; an unknown one is refused.
    [Fact]
    public async Task No_time_zone_is_utc_and_an_unknown_one_is_refused()
    {
        var (eventId, lead, _) = await HubAsync();

        Assert.Contains("Times are in UTC.", Page(await EntriesAsync(await lead.GetAsync(Archive(eventId)))));

        var refused = await lead.GetAsync(Archive(eventId, "Mars/Olympus_Mons"));
        Assert.Equal(HttpStatusCode.BadRequest, refused.StatusCode);
        var errors = (await refused.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("errors");
        Assert.Equal("Choose a known time zone.", errors.EnumerateObject().Single(p => p.Name.Equals("timeZone", StringComparison.OrdinalIgnoreCase)).Value[0].GetString());
        Assert.Single(await ArchiveAuditAsync(eventId)); // the UTC download only; the refused request audits nothing
    }

    // L2-198 AC2, L2-151: a member without ManageEventHubs gets 403, FaithTech's Staff and Volunteer included, and nothing is audited.
    [Theory]
    [InlineData(Role.Staff)]
    [InlineData(Role.Volunteer)]
    public async Task A_member_without_ManageEventHubs_gets_403(Role role)
    {
        var (eventId, _, _) = await HubAsync();
        var other = factory.ClientFor(await factory.AddMemberAsync("Jonah Bell"), role);

        Assert.Equal(HttpStatusCode.Forbidden, (await other.GetAsync(Archive(eventId))).StatusCode);
        var events = factory.ClientWithCapabilities(await factory.AddMemberAsync("Leah Park"), Capability.ManageEvents);
        Assert.Equal(HttpStatusCode.Forbidden, (await events.GetAsync(Archive(eventId))).StatusCode);
        Assert.Empty(await ArchiveAuditAsync(eventId));
    }

    // L2-198 AC3: there is no anonymous archive.
    [Fact]
    public async Task Anonymous_callers_get_401()
    {
        var (eventId, _, _) = await HubAsync();

        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.CreateClient().GetAsync(Archive(eventId))).StatusCode);
    }

    // L2-198 AC4: another organisation's event, an unknown event and an event without a hub are all 404.
    [Fact]
    public async Task Another_organisations_event_an_unknown_event_and_an_event_without_a_hub_are_404()
    {
        var (eventId, lead, _) = await HubAsync();
        var noHub = await factory.AddEventAsync("Prayer Night", TimeSpan.FromDays(3));
        var northside = await factory.NorthsideClientAsync(Role.CityLead);

        Assert.Equal(HttpStatusCode.NotFound, (await northside.GetAsync(Archive(eventId))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await lead.GetAsync(Archive(Guid.NewGuid()))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await lead.GetAsync(Archive(noHub.Id))).StatusCode);
    }

    // L2-198 AC5: a section naming another organisation's resource or profile never brings its file into the zip.
    [Fact]
    public async Task Another_organisations_files_and_photos_are_never_read()
    {
        var (eventId, lead, member) = await HubAsync();
        var ours = (await factory.AddFileAsync(member, new ResourceClients.Upload("ours.pdf", ResourceClients.Pdf))).Id;
        var northside = await factory.NorthsideClientAsync(Role.CityLead);
        var upload = await northside.UploadAsync(new ResourceClients.Upload("theirs.pdf", ResourceClients.Pdf));
        var theirs = (await upload.Content.ReadFromJsonAsync<ResourceClients.Detail[]>())!.Single().Id;
        var theirMember = await factory.WithDbAsync(db => db.Profiles.IgnoreQueryFilters().Where(p => p.OrganisationId != FaithTech.Community.Infrastructure.Persistence.Seed.FaithTechSeed.OrganisationId).Select(p => p.Id).FirstAsync());
        await factory.WithDbAsync(async db =>
        {
            var hub = await db.EventHubs.Include(h => h.Sections).SingleAsync(h => h.EventId == eventId);
            hub.FillSection(HubSectionKind.Slides, JsonSerializer.Serialize(new { slides = new[] { new { resourceId = theirs }, new { resourceId = ours } } }), DateTimeOffset.UtcNow);
            hub.FillSection(HubSectionKind.People, JsonSerializer.Serialize(new { people = new object[] { new { profileId = theirMember, role = "Mentor" }, new { name = "Pastor Calin", role = "Judge" } } }), DateTimeOffset.UtcNow);
            return await db.SaveChangesAsync();
        });

        var entries = await EntriesAsync(await lead.GetAsync(Archive(eventId)));

        Assert.Equal([$"{Folder}/index.html", $"{Folder}/slides/01.pdf"], entries.Keys.Order());
        Assert.Equal(ResourceClients.Pdf, entries[$"{Folder}/slides/01.pdf"]);
        var page = Page(entries);
        Assert.Contains("1. ours (PDF)", page);
        Assert.DoesNotContain("theirs", page);
        Assert.Contains("Pastor Calin", page);
    }

    // L2-198 AC7: each download is audited against the hub; an administrator without the capability is an override.
    [Fact]
    public async Task Each_download_is_audited_and_an_administrators_is_an_override()
    {
        var (eventId, lead, _) = await HubAsync();
        var admin = factory.ClientWithCapabilities(await factory.AddMemberAsync("Priya Shah"), Capability.AdministerOrganisation);

        Assert.Equal(HttpStatusCode.OK, (await lead.GetAsync(Archive(eventId, "America/Toronto"))).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync(Archive(eventId))).StatusCode);

        var audit = await ArchiveAuditAsync(eventId);
        Assert.Equal(2, audit.Count);
        Assert.Contains("\"Override\":false", audit[0].After);
        Assert.Contains("\"TimeZone\":\"America/Toronto\"", audit[0].After);
        Assert.Contains("\"Override\":true", audit[1].After);
    }
}
