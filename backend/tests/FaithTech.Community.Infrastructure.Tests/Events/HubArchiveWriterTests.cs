// Traces to: L2-197 (docs/detailed-designs/events/download-hub-archive, ADR 0046)
using System.IO.Compression;
using System.Text;
using FaithTech.Community.Application.Events;
using FaithTech.Community.Infrastructure.Events;

namespace FaithTech.Community.Infrastructure.Tests.Events;

public class HubArchiveWriterTests
{
    private const string Folder = "toronto-builders-night-hub";
    private const string Link = "https://faithtech.community.test/public/events/3f2b6c1e-8a4d-4f0e-9b7a-2c5d1e6f7a80/hub";
    private static readonly TimeZoneInfo Toronto = TimeZoneInfo.FindSystemTimeZoneById("America/Toronto");
    private static readonly DateTimeOffset Start = new(2026, 11, 6, 23, 30, 0, TimeSpan.Zero); // 6:30 pm in Toronto
    private static readonly Guid Slide1 = Guid.NewGuid(), Slide2 = Guid.NewGuid(), Map = Guid.NewGuid(), Grace = Guid.NewGuid(), Samuel = Guid.NewGuid();

    private readonly HubArchiveWriter _writer = new();

    // AC1: one folder holding index.html and each file at its path, and nothing else.
    [Fact]
    public async Task The_zip_holds_one_folder_with_index_html_and_each_file_at_its_path()
    {
        var zip = await WriteAsync(Archive(Toronto));

        Assert.Equal(
            [$"{Folder}/index.html", $"{Folder}/slides/01.jpg", $"{Folder}/slides/02.pdf", $"{Folder}/images/parking-1.png", $"{Folder}/images/person-1.jpg"],
            zip.Keys);
        Assert.Equal("slide one", zip[$"{Folder}/slides/01.jpg"]);
        Assert.Equal("grace", zip[$"{Folder}/images/person-1.jpg"]);
    }

    // AC2: the event's header, the saved note naming the time zone, and the footer; no script, font or stylesheet.
    [Fact]
    public async Task The_page_has_the_events_header_the_saved_note_and_the_footer_and_loads_nothing()
    {
        var html = await PageAsync(Archive(Toronto));

        Assert.Single(Occurrences(html, "<h1"));
        Assert.Contains("<h1>Toronto Builders Night</h1>", html);
        Assert.Contains("<p class=\"overline\">FaithTech</p>", html);
        Assert.Contains("<p>An evening of building &amp; prayer.</p>", html);
        Assert.Contains("Fri 6 Nov 2026 · 6:30 – 9:00 pm · Centre for Social Innovation, Toronto", html);
        Assert.Contains("A copy of the hub, saved Mon 9 Nov 2026. It opens without the app; links to other sites need a connection. Times are in America/Toronto.", html);
        Assert.Contains($"The live hub: <a href=\"{Link}\">{Link}</a>", html);
        Assert.DoesNotContain("<script", html);
        Assert.DoesNotContain("<link", html);
        Assert.DoesNotContain("@import", html);
        Assert.DoesNotContain("src=\"http", html);
        Assert.StartsWith("<!doctype html>", html);
    }

    // AC2: every shown section, in the hub's order, under its own heading; Hero is the header.
    [Fact]
    public async Task Every_shown_section_has_its_heading_in_the_hubs_order()
    {
        var html = await PageAsync(Archive(Toronto));

        string[] headings =
        [
            "Agenda", "Where", "Parking", "What to bring", "Partners", "Tracks", "The Create Cycle", "Rules", "People",
            "Submission and feedback", "Demo format", "Judging and honors", "Worship", "Slides", "Giving", "Upcoming events",
        ];
        var at = headings.Select(h => html.IndexOf($">{h}</h2>", StringComparison.Ordinal)).ToList();
        Assert.DoesNotContain(-1, at);
        Assert.Equal(at.Order(), at);
        Assert.Equal(headings.Length, Occurrences(html, "<h2").Count);
    }

    // AC3, AC7: the agenda is a static list of times in the time zone, with no live marks.
    [Fact]
    public async Task The_agenda_is_a_static_list_with_times_in_the_time_zone()
    {
        var html = await PageAsync(Archive(Toronto));

        Assert.Contains("<time class=\"lead\" datetime=\"2026-11-06T18:30:00-05:00\">6:30 pm</time><div><strong>Doors open</strong><p class=\"muted\">Pizza and introductions.</p></div>", html);
        Assert.Contains(">7:15 pm</time><div><strong>Lightning demos</strong></div>", html);
        Assert.DoesNotContain("Happening now", html);
        Assert.DoesNotContain("Up next", html);
        Assert.Contains("Code freeze at 8:15 pm", html);
    }

    // AC7: with no time zone the times are in UTC, and the note says so.
    [Fact]
    public async Task With_utc_the_times_and_the_note_are_in_utc()
    {
        var html = await PageAsync(Archive(TimeZoneInfo.Utc));

        Assert.Contains("Times are in UTC.", html);
        Assert.Contains(">11:30 pm</time><div><strong>Doors open</strong>", html);
        Assert.Contains("Fri 6 Nov 2026 · 11:30 pm – Sat 7 Nov 2026 · 2:00 am", html);
    }

    // AC4: maps, slides and photos point at their files in the zip; a PDF is a link; no photo gives initials.
    [Fact]
    public async Task Maps_slides_and_photos_are_the_files_in_the_zip()
    {
        var html = await PageAsync(Archive(Toronto));

        Assert.Contains("<a href=\"images/parking-1.png\"><img src=\"images/parking-1.png\" alt=\"Map of On-site parking\"></a>", html);
        Assert.Contains("<a href=\"slides/01.jpg\"><img src=\"slides/01.jpg\" alt=\"Slide 1: Welcome\"></a><figcaption>1. Welcome</figcaption>", html);
        Assert.Contains("<a href=\"slides/02.pdf\">2. Track briefs (PDF)</a>", html);
        Assert.Contains("<img class=\"avatar\" src=\"images/person-1.jpg\" alt=\"\"><div><strong>Grace Okonkwo</strong>", html);
        Assert.Contains("<span class=\"avatar\" aria-hidden=\"true\">SA</span><div><strong>Samuel Adeyemi</strong><p class=\"muted\">Product engineer</p>", html);
        Assert.DoesNotContain("photos.test", html);
    }

    // AC5: a slide, map or photo the handler found no file for is left out, not linked to nothing.
    [Fact]
    public async Task A_file_with_no_entry_is_left_out()
    {
        var html = await PageAsync(Archive(Toronto) with { Files = new Dictionary<Guid, HubArchiveEntry>(), Photos = new Dictionary<Guid, HubArchiveEntry>() });

        Assert.DoesNotContain("slides/", html);
        Assert.DoesNotContain("images/", html);
        Assert.Contains("<h3>On-site parking</h3>", html);
        Assert.Contains("<span class=\"avatar\" aria-hidden=\"true\">GO</span>", html);
    }

    // AC2: the hackathon sections, as the hub page words them.
    [Fact]
    public async Task The_hackathon_sections_read_as_on_the_hub_page()
    {
        var html = await PageAsync(Archive(Toronto));

        Assert.Contains("<p class=\"overline\">Track 1 · Primary focus</p><h3>Mobile-first onboarding</h3>", html);
        Assert.Contains("<a href=\"https://github.com/example/briefs\">Track 1 brief</a>", html);
        Assert.Contains("<p class=\"overline\">Hour 1</p><h3>Lament</h3>", html);
        Assert.Contains("<span class=\"lead\">1</span><div><strong>Start fresh</strong>", html);
        Assert.Contains("Three minutes per team, then two minutes of questions.", html);
        Assert.Contains("<span class=\"lead\">0:00 to 0:30</span><div><strong>The track</strong>", html);
        Assert.Contains("Judges score each team 1 to 5 on each criterion.", html);
        Assert.Contains("<th scope=\"row\">Redemptive potential (40%)</th>", html);
        Assert.Contains("<p class=\"overline\">Honor 01 · Mentors’ pick</p><h3>Most Collaborative</h3>", html);
        Assert.Contains("<a class=\"end\" href=\"https://kestrel.example\">kestrel.example</a>", html);
        Assert.Contains("<a class=\"end\" href=\"https://music.example/song\">Listen ahead</a>", html);
        Assert.Contains("<a class=\"button\" href=\"https://forms.example/submit\">Submit your project</a>", html);
        Assert.Contains("<a class=\"button\" href=\"https://faithtech.com/give\">Give to FaithTech</a>", html);
        Assert.Contains("<li>Laptop and charger</li>", html);
        Assert.Contains("<h3 style=\"margin: 1rem 0 0.5rem\">Speakers</h3>", html);
        Assert.Contains("<a href=\"https://faithtech.community.test/public/events/", html);
        Assert.Contains("<strong>Toronto Create Day</strong>", html);
    }

    // AC6: inline styles from the design tokens, light and dark, a skip link to main.
    [Fact]
    public async Task The_styles_are_inline_with_the_tokens_light_and_dark_and_there_is_a_skip_link()
    {
        var html = await PageAsync(Archive(Toronto));

        Assert.Contains("<style>", html);
        Assert.Contains("--color-bg-canvas: #f6f7f9;", html);
        Assert.Contains("@media (prefers-color-scheme: dark)", html);
        Assert.Contains("--color-bg-canvas: #0f1216;", html);
        Assert.Contains("<a class=\"skip-link\" href=\"#main\">Skip to content</a>", html);
        Assert.Contains("<main id=\"main\">", html);
        Assert.Contains("<html lang=\"en\">", html);
    }

    // Text from the hub is escaped, so a section cannot add markup to the page.
    [Fact]
    public async Task Text_is_escaped()
    {
        var hub = Hub() with { Event = Hub().Event with { Title = "<script>alert(1)</script> Night" } };
        var html = await PageAsync(Archive(Toronto) with { Hub = hub });

        Assert.Contains("<h1>&lt;script&gt;alert(1)&lt;/script&gt; Night</h1>", html);
        Assert.DoesNotContain("<script>", html);
    }

    private async Task<Dictionary<string, string>> WriteAsync(HubArchive archive)
    {
        using var output = new MemoryStream();
        await _writer.WriteAsync(archive, output);
        output.Position = 0;
        using var zip = new ZipArchive(output, ZipArchiveMode.Read);
        var entries = new Dictionary<string, string>();
        foreach (var entry in zip.Entries)
        {
            using var reader = new StreamReader(entry.Open(), Encoding.UTF8);
            entries[entry.FullName] = await reader.ReadToEndAsync();
        }

        return entries;
    }

    private async Task<string> PageAsync(HubArchive archive) => (await WriteAsync(archive))[$"{Folder}/index.html"];

    private static List<int> Occurrences(string text, string value)
    {
        var found = new List<int>();
        for (var i = text.IndexOf(value, StringComparison.Ordinal); i >= 0; i = text.IndexOf(value, i + 1, StringComparison.Ordinal))
        {
            found.Add(i);
        }

        return found;
    }

    private static HubArchiveEntry Entry(string path, string content) =>
        new(path, _ => Task.FromResult<Stream>(new MemoryStream(Encoding.UTF8.GetBytes(content))));

    private static HubArchive Archive(TimeZoneInfo zone) => new(
        Hub(), zone, new DateTimeOffset(2026, 11, 9, 15, 0, 0, TimeSpan.Zero), Folder,
        new Dictionary<Guid, HubArchiveEntry>
        {
            [Slide1] = Entry("slides/01.jpg", "slide one"),
            [Slide2] = Entry("slides/02.pdf", "pdf"),
            [Map] = Entry("images/parking-1.png", "map"),
        },
        new Dictionary<Guid, HubArchiveEntry> { [Grace] = Entry("images/person-1.jpg", "grace") });

    private static HubSectionDto Section(string kind, object content) => new(kind, true, "Ready", content);

    private static EventHubDto Hub() => new(
        Guid.NewGuid(), Guid.NewGuid(), "Published", "blank", Link,
        new HubEventFactsDto("Toronto Builders Night", Start, Start.AddHours(2.5), "InPerson", "Centre for Social Innovation, Toronto", null,
            "https://faithtech.community.test/public/events/3f2b", false),
        [
            Section("Hero", new HeroContent("An evening of building & prayer.")),
            Section("Agenda", new AgendaContent([
                new AgendaItem(Start, "Doors open", "Pizza and introductions."),
                new AgendaItem(Start.AddMinutes(45), "Lightning demos", null),
            ])),
            Section("Venue", new VenueContent("Use the Spadina entrance.")),
            Section("Parking", new HubParkingDto("Arrive early.", [new HubParkingOptionDto("On-site parking", "Lots A and B.", Map, "On-site map")])),
            Section("WhatToBring", new WhatToBringContent(["Laptop and charger"], [new HubTitledItem("Lunch", "Provided at noon.")])),
            Section("Partners", new HubPartnersDto([new HubPartnerDto(Guid.NewGuid(), "Kestrel Labs", "Mentors and pizza", "https://kestrel.example")], "Meet our partner.")),
            Section("Tracks", new TracksContent(
                [new HubTrack("Mobile-first onboarding", "Help a newcomer.", "https://github.com/example/briefs", null, true), new HubTrack("Testimony sharing", null, null, null, false)],
                [new HubTitledItem("It works on a phone", null)])),
            Section("Process", new ProcessContent("The Create Cycle", "Four steps.", [new ProcessStage("Lament", "Hour 1", "Name what is broken.", [new HubTitledItem("Listen", "To the people it is for.")])])),
            Section("Rules", new RulesContent([new HubTitledItem("Start fresh", "Write the code today.")], "Ask a mentor when unsure.")),
            Section("People", new HubPeopleDto([
                new HubPersonDto(Grace, "Grace Okonkwo", null, "Speaker", "https://photos.test/grace.jpg"),
                new HubPersonDto(null, "Samuel Adeyemi", "Product engineer", "Speaker", null),
            ])),
            Section("Links", new LinksContent("https://forms.example/submit", "https://forms.example/feedback", Start.AddHours(1.75))),
            Section("DemoFormat", new DemoFormatContent(3, 2, [new DemoSegment("The track", null, 30), new DemoSegment("Tend", "Show it.", 90)], ["Practise once"])),
            Section("Judging", new JudgingContent(5,
                [new JudgingCriterion("Redemptive potential", "Does it bring people closer?", "It clearly serves.", 40)],
                [new JudgingHonor("Most Collaborative", "The team that helped most.", "MentorsPick")], null)),
            Section("Worship", new WorshipContent("We open with two songs.", [new WorshipSong("Way Maker", "Sinach", "https://music.example/song")])),
            Section("Slides", new HubSlidesDto([new HubSlideDto(Slide1, "Welcome", "Image"), new HubSlideDto(Slide2, "Track briefs", "Pdf")])),
            Section("Giving", new GivingContent("Thank you for building with us.")),
            Section("UpcomingEvents", new UpcomingEventsContent(3)),
        ],
        new HubOrganisationDto("FaithTech", "FaithTech", "https://faithtech.com/give", "Gifts fund city events."),
        [new HubUpcomingEventDto(Guid.NewGuid(), "Toronto Create Day", Start.AddDays(70), Start.AddDays(70).AddHours(8), "InPerson", "Toronto", "Toronto")]);
}
