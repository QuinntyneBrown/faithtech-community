// Traces to: L2-024, L2-022 AC1
using FaithTech.Community.Application.Organisations;
using FaithTech.Community.Domain.Events;
using FaithTech.Community.Domain.Organisations;
using FaithTech.Community.Infrastructure.Calendar;
using FaithTech.Community.Infrastructure.Persistence.Seed;
using Microsoft.Extensions.Time.Testing;

namespace FaithTech.Community.Infrastructure.Tests.Calendar;

public class IcsCalendarWriterTests
{
    private static readonly DateTimeOffset Start = new(2026, 11, 6, 18, 30, 0, TimeSpan.FromHours(-5));
    private readonly IcsCalendarWriter _writer = Writer(FaithTechSeed.Organisation());

    private static IcsCalendarWriter Writer(Organisation organisation)
    {
        var scope = new OrganisationScope();
        scope.Set(organisation);
        return new IcsCalendarWriter(new FakeTimeProvider(new DateTimeOffset(2026, 10, 21, 12, 0, 0, TimeSpan.Zero)), scope);
    }

    // L2-134 AC4: the file carries the name of the organisation it was downloaded in.
    [Fact]
    public void The_product_id_and_the_organiser_carry_the_organisations_name()
    {
        var northside = new Organisation(Guid.NewGuid(), "northside", "app.northside.test", "Northside Makers", "Northside", DateTime.UtcNow);

        var lines = Lines(Writer(northside).Write(InPerson()));

        Assert.Contains("PRODID:-//Northside Makers//Events//EN", lines);
        Assert.Contains("ORGANIZER;CN=\"Northside Makers\":https://app.northside.test", lines);
        Assert.DoesNotContain(lines, line => line.Contains("FaithTech", StringComparison.Ordinal));
    }

    private static readonly FaithTech.Community.Domain.Organisations.EventType BuildersNight = new(Guid.NewGuid(), "builders-night", "Builders night", 2);
    private static readonly FaithTech.Community.Domain.Organisations.EventType PrayerAndPlanning = new(Guid.NewGuid(), "prayer-and-planning", "Prayer & planning", 4);

    private static Event InPerson(string title = "Toronto Builders Night") =>
        new(title, "Demos, then open tables.", BuildersNight, Start, Start.AddHours(2.5), null,
            EventFormat.InPerson, "Kestrel Labs, 220 King St W", null, null, EventVisibility.Public, Guid.NewGuid());

    private static string[] Lines(string ics) => ics.Split("\r\n");

    [Fact]
    public void Writes_one_rfc5545_event_with_crlf_lines_a_stable_uid_and_utc_times()
    {
        var e = InPerson();

        var ics = _writer.Write(e);

        Assert.EndsWith("\r\n", ics);
        Assert.DoesNotContain("\n", ics.Replace("\r\n", string.Empty));
        var lines = Lines(ics);
        Assert.Equal("BEGIN:VCALENDAR", lines[0]);
        Assert.Contains("VERSION:2.0", lines);
        Assert.Contains("PRODID:-//FaithTech Community//Events//EN", lines);
        Assert.Contains("ORGANIZER;CN=\"FaithTech Community\":https://app.faithtech.community", lines);
        Assert.Contains("BEGIN:VEVENT", lines);
        Assert.Contains($"UID:{e.Id}@faithtech.community", lines);
        Assert.Contains("DTSTAMP:20261021T120000Z", lines);
        Assert.Contains("DTSTART:20261106T233000Z", lines);
        Assert.Contains("DTEND:20261107T020000Z", lines);
        Assert.Contains("SUMMARY:Toronto Builders Night", lines);
        Assert.Contains("LOCATION:Kestrel Labs\\, 220 King St W", lines);
        Assert.Contains("SEQUENCE:0", lines);
        Assert.Contains("STATUS:CONFIRMED", lines);
        Assert.Equal("END:VCALENDAR", lines[^2]);
        Assert.Equal(_writer.Write(e).Split("\r\n").Single(l => l.StartsWith("UID:")), lines.Single(l => l.StartsWith("UID:")));
    }

    [Fact]
    public void An_online_event_carries_its_link_as_the_url_and_no_location()
    {
        var e = new Event("Prayer & Planning", "", PrayerAndPlanning, Start, Start.AddHours(1), null,
            EventFormat.Online, null, "https://meet.example.org/ft", null, EventVisibility.MembersOnly, Guid.NewGuid());

        var lines = Lines(_writer.Write(e));

        Assert.Contains("URL:https://meet.example.org/ft", lines);
        Assert.DoesNotContain(lines, l => l.StartsWith("LOCATION:"));
    }

    [Fact]
    public void The_public_copy_links_the_public_page_instead_of_the_joining_link()
    {
        var e = new Event("Prayer & Planning", "", PrayerAndPlanning, Start, Start.AddHours(1), null,
            EventFormat.Online, null, "https://meet.example.org/ft", null, EventVisibility.Public, Guid.NewGuid());

        var lines = Lines(_writer.Write(e, "https://app.example/public/events/1"));

        Assert.Contains("URL:https://app.example/public/events/1", lines);
        Assert.DoesNotContain(lines, l => l.Contains("meet.example.org", StringComparison.Ordinal));
    }

    [Fact]
    public void A_changed_or_cancelled_event_carries_a_higher_sequence_and_the_cancelled_status()
    {
        var e = InPerson();
        e.Update("Toronto Builders Night", "", BuildersNight, Start, Start.AddHours(3), null,
            EventFormat.InPerson, "Trinity Community Centre", null, null, EventVisibility.Public);
        e.Cancel("The venue flooded.");

        var lines = Lines(_writer.Write(e));

        Assert.Contains("SEQUENCE:2", lines);
        Assert.Contains("STATUS:CANCELLED", lines);
    }

    [Fact]
    public void Escapes_text_and_folds_long_lines_at_75_octets()
    {
        var e = InPerson("Builders; Night, with \\ backslash and a title long enough to need folding across lines ✨");

        var ics = _writer.Write(e);

        Assert.All(Lines(ics), l => Assert.True(System.Text.Encoding.UTF8.GetByteCount(l) <= 75, l));
        var unfolded = ics.Replace("\r\n ", string.Empty);
        Assert.Contains("SUMMARY:Builders\\; Night\\, with \\\\ backslash and a title long enough to need folding across lines ✨", unfolded.Split("\r\n"));
    }
}
