using System.Globalization;
using System.IO.Compression;
using System.Text;
using FaithTech.Community.Application.Events;

namespace FaithTech.Community.Infrastructure.Events;

/// <summary>
/// Writes a hub archive (L2-197, ADR 0046): "{folder}/index.html", one static page of the hub as visitors see it, then each
/// stored file the page uses under "{folder}/". The page has no script, font or external stylesheet; its words and order
/// follow the hub page's displays (docs/design-system/patterns/event-hub-sections.html#saved-copy) and its markup the mocks in
/// docs/mocks/pages/hub-archive. Every piece of hub text is escaped.
/// </summary>
public class HubArchiveWriter : IHubArchiveWriter
{
    private static readonly string[] Words = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

    private static readonly (string Role, string Title)[] PeopleGroups = [("Speaker", "Speakers"), ("Mentor", "Mentors"), ("Judge", "Judges")];

    private static readonly Dictionary<string, string> ChosenBy = new(StringComparer.OrdinalIgnoreCase)
    {
        ["TopScore"] = "Top score",
        ["JudgesPick"] = "Judges’ pick",
        ["MentorsPick"] = "Mentors’ pick",
        ["Vote"] = "Everyone’s vote",
    };

    public async Task WriteAsync(HubArchive archive, Stream output, CancellationToken cancellationToken = default)
    {
        using var zip = new ZipArchive(output, ZipArchiveMode.Create, leaveOpen: true);
        var index = zip.CreateEntry($"{archive.Folder}/index.html", CompressionLevel.Optimal);
        await using (var page = index.Open())
        {
            var bytes = new UTF8Encoding(false).GetBytes(new Page(archive).Write());
            await page.WriteAsync(bytes, cancellationToken);
        }

        foreach (var file in archive.Files.Values.Concat(archive.Photos.Values).DistinctBy(f => f.Path))
        {
            var entry = zip.CreateEntry($"{archive.Folder}/{file.Path}", CompressionLevel.Optimal);
            await using var source = await file.Open(cancellationToken);
            await using var target = entry.Open();
            await source.CopyToAsync(target, cancellationToken);
        }
    }

    private static string E(string? text) => string.IsNullOrEmpty(text)
        ? string.Empty
        : text.Replace("&", "&amp;", StringComparison.Ordinal).Replace("<", "&lt;", StringComparison.Ordinal)
            .Replace(">", "&gt;", StringComparison.Ordinal).Replace("\"", "&quot;", StringComparison.Ordinal);

    private static string Initials(string name) =>
        string.Concat(name.Split(' ', StringSplitOptions.RemoveEmptyEntries).Take(2).Select(w => char.ToUpperInvariant(w[0])));

    private static string Minutes(int n) => $"{(n < Words.Length ? Words[n] : n.ToString(CultureInfo.InvariantCulture))} {(n == 1 ? "minute" : "minutes")}";

    private static string Clock(int seconds) => $"{seconds / 60}:{seconds % 60:00}";

    /// <summary>One archive's page: the time zone, the files and the text builder.</summary>
    private sealed class Page(HubArchive archive)
    {
        private readonly StringBuilder _html = new();
        private readonly EventHubDto _hub = archive.Hub;

        public string Write()
        {
            var e = _hub.Event;
            var subtitle = Content<HeroContent>("Hero")?.Subtitle;
            var when = $"{Range(e.StartsAt, e.EndsAt)} · {Place()}";
            var org = _hub.Organisation?.Name ?? string.Empty;
            var zone = archive.TimeZone == TimeZoneInfo.Utc ? "UTC" : archive.TimeZone.Id;
            _html.Append("<!doctype html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n")
                .Append("<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n")
                .Append($"<title>{E(e.Title)} hub</title>\n")
                .Append($"<meta name=\"description\" content=\"{E(string.IsNullOrWhiteSpace(subtitle) ? when : subtitle)}\">\n")
                .Append($"<style>\n{HubArchiveStyles.Css}\n</style>\n</head>\n<body>\n")
                .Append("<a class=\"skip-link\" href=\"#main\">Skip to content</a>\n<div class=\"archive\">\n")
                .Append($"<header class=\"hero stack\">\n<p class=\"overline\">{E(org)}</p>\n<h1>{E(e.Title)}</h1>\n");
            if (!string.IsNullOrWhiteSpace(subtitle))
            {
                _html.Append($"<p>{E(subtitle)}</p>\n");
            }

            _html.Append($"<p class=\"muted\">{E(when)}</p>\n</header>\n")
                .Append($"<p class=\"saved\" role=\"note\">A copy of the hub, saved {Day(archive.SavedAt)}. It opens without the app; links to other sites need a connection. Times are in {E(zone)}.</p>\n");
            if (!string.IsNullOrWhiteSpace(_hub.UpdateBanner))
            {
                _html.Append($"<p class=\"saved\" role=\"note\"><strong>Update:</strong> {E(_hub.UpdateBanner)}</p>\n");
            }

            _html.Append("<main id=\"main\">\n");
            foreach (var section in _hub.Sections.Where(s => s.Kind != "Hero"))
            {
                Section(section);
            }

            _html.Append("</main>\n")
                .Append($"<footer><p>Saved from {E(org)}. The live hub: <a href=\"{E(_hub.Link)}\">{E(_hub.Link)}</a></p></footer>\n")
                .Append("</div>\n</body>\n</html>\n");
            return _html.ToString();
        }

        private T? Content<T>(string kind)
            where T : class => _hub.Sections.FirstOrDefault(s => s.Kind == kind)?.Content as T;

        private string Place() => _hub.Event.Format == "Online" ? "Online" : _hub.Event.Venue ?? string.Empty;

        private DateTimeOffset Local(DateTimeOffset at) => TimeZoneInfo.ConvertTime(at, archive.TimeZone);

        private string Day(DateTimeOffset at, bool year = true)
        {
            var d = Local(at);
            var day = $"{d.ToString("ddd", CultureInfo.InvariantCulture)} {d.Day} {d.ToString("MMM", CultureInfo.InvariantCulture)}";
            return year ? $"{day} {d.Year}" : day;
        }

        private string Time(DateTimeOffset at)
        {
            var d = Local(at);
            return $"{(d.Hour % 12 == 0 ? 12 : d.Hour % 12)}:{d.Minute:00} {(d.Hour < 12 ? "am" : "pm")}";
        }

        /// <summary>"6:30 – 9:00 pm" within a day (the suffix once when shared), "11:00 am – 1:00 pm" across noon.</summary>
        private string Times(DateTimeOffset from, DateTimeOffset to)
        {
            var first = Time(from);
            var last = Time(to);
            return first[^2..] == last[^2..] ? $"{first[..^3]} – {last}" : $"{first} – {last}";
        }

        /// <summary>"Fri 6 Nov 2026 · 6:30 – 9:00 pm", or both days in full across midnight.</summary>
        private string Range(DateTimeOffset from, DateTimeOffset to) => Local(from).Date == Local(to).Date
            ? $"{Day(from)} · {Times(from, to)}"
            : $"{Day(from)} · {Time(from)} – {Day(to)} · {Time(to)}";

        private string? FilePath(Guid? resourceId) =>
            resourceId is { } id && archive.Files.TryGetValue(id, out var entry) ? entry.Path : null;

        private void Open(string kind, string heading) =>
            _html.Append($"<section aria-labelledby=\"s-{kind.ToLowerInvariant()}\"><h2 id=\"s-{kind.ToLowerInvariant()}\">{E(heading)}</h2>");

        private void Close() => _html.Append("</section>\n");

        private void Paragraph(string? text, string? style = null)
        {
            if (!string.IsNullOrWhiteSpace(text))
            {
                _html.Append(style is null ? $"<p>{E(text)}</p>" : $"<p style=\"{style}\">{E(text)}</p>");
            }
        }

        private static string Titled(string? title, string? detail) =>
            $"<div><strong>{E(title)}</strong>{(string.IsNullOrWhiteSpace(detail) ? string.Empty : $"<p class=\"muted\">{E(detail)}</p>")}</div>";

        private void Rows(IEnumerable<string> items, string list = "ul")
        {
            _html.Append($"<{list} class=\"rows\">");
            foreach (var item in items)
            {
                _html.Append($"<li>{item}</li>");
            }

            _html.Append($"</{list}>");
        }

        private void SubHeading(string text) => _html.Append($"<h3 style=\"margin: 1rem 0 0.5rem\">{E(text)}</h3>");

        private void Section(HubSectionDto section)
        {
            switch (section.Content)
            {
                case AgendaContent agenda:
                    Open(section.Kind, "Agenda");
                    Rows((agenda.Items ?? []).Select(i => (i.StartsAt is { } at
                        ? $"<time class=\"lead\" datetime=\"{Local(at).ToString("yyyy-MM-dd'T'HH:mm:sszzz", CultureInfo.InvariantCulture)}\">{Time(at)}</time>"
                        : "<span class=\"lead\"></span>") + Titled(i.Title, i.Detail)), "ol");
                    break;
                case VenueContent venue:
                    Open(section.Kind, "Where");
                    var place = _hub.Event.Venue ?? string.Empty;
                    _html.Append($"<div class=\"card stack\"><p><strong>{E(place)}</strong></p>");
                    Paragraph(venue.Directions);
                    _html.Append($"<p><a href=\"https://www.google.com/maps/search/?api=1&amp;query={Uri.EscapeDataString(place)}\">Open in maps</a></p></div>");
                    break;
                case HubParkingDto parking:
                    Open(section.Kind, "Parking");
                    Paragraph(parking.Note);
                    _html.Append(string.IsNullOrWhiteSpace(parking.Note) ? "<div class=\"grid\">" : "<div class=\"grid\" style=\"margin-top: 0.75rem\">");
                    foreach (var option in parking.Options)
                    {
                        _html.Append($"<article class=\"card stack\"><h3>{E(option.Title)}</h3>");
                        if (FilePath(option.MapResourceId) is { } map)
                        {
                            _html.Append($"<a href=\"{map}\"><img src=\"{map}\" alt=\"Map of {E(option.Title)}\"></a>");
                        }

                        Paragraph(option.Notes);
                        _html.Append("</article>");
                    }

                    _html.Append("</div>");
                    break;
                case WhatToBringContent bring:
                    Open(section.Kind, "What to bring");
                    if (bring.Bring is { Count: > 0 } things)
                    {
                        Rows(things.Select(E));
                    }

                    if (bring.OnTheDay is { Count: > 0 } day)
                    {
                        SubHeading("On the day");
                        Rows(day.Select(i => Titled(i.Title, i.Detail)));
                    }

                    break;
                case HubPartnersDto partners:
                    Open(section.Kind, "Partners");
                    Paragraph(partners.Meet, "margin-bottom: 0.75rem");
                    Rows(partners.Partners.Select(p =>
                        $"<span class=\"avatar\" aria-hidden=\"true\">{E(Initials(p.Name))}</span>{Titled(p.Name, p.Offering)}"
                        + (Uri.TryCreate(p.Website, UriKind.Absolute, out var site)
                            ? $"<a class=\"end\" href=\"{E(p.Website)}\">{E(site.Host.StartsWith("www.", StringComparison.Ordinal) ? site.Host[4..] : site.Host)}</a>"
                            : string.Empty)));
                    break;
                case TracksContent tracks:
                    Open(section.Kind, "Tracks");
                    _html.Append("<div class=\"grid\">");
                    var n = 0;
                    foreach (var track in tracks.Tracks ?? [])
                    {
                        n++;
                        _html.Append($"<article class=\"card stack\"><p class=\"overline\">Track {n}{(track.Primary ? " · Primary focus" : string.Empty)}</p><h3>{E(track.Title)}</h3>");
                        Paragraph(track.Brief);
                        if (!string.IsNullOrWhiteSpace(track.LinkUrl))
                        {
                            _html.Append($"<p><a href=\"{E(track.LinkUrl)}\">{E(track.LinkText ?? $"Track {n} brief")}</a></p>");
                        }

                        _html.Append("</article>");
                    }

                    _html.Append("</div>");
                    if (tracks.GoodLooksLike is { Count: > 0 } good)
                    {
                        SubHeading("What good looks like");
                        Rows(good.Select(i => Titled(i.Title, i.Detail)));
                    }

                    break;
                case ProcessContent process:
                    Open(section.Kind, string.IsNullOrWhiteSpace(process.Name) ? "Process" : process.Name);
                    Paragraph(process.Intro, "margin-bottom: 0.75rem");
                    _html.Append("<div class=\"grid\">");
                    foreach (var stage in process.Stages ?? [])
                    {
                        _html.Append("<article class=\"card stack\">");
                        if (!string.IsNullOrWhiteSpace(stage.When))
                        {
                            _html.Append($"<p class=\"overline\">{E(stage.When)}</p>");
                        }

                        _html.Append($"<h3>{E(stage.Title)}</h3>");
                        Paragraph(stage.Summary);
                        if (stage.Points is { Count: > 0 } points)
                        {
                            Rows(points.Select(i => Titled(i.Title, i.Detail)));
                        }

                        _html.Append("</article>");
                    }

                    _html.Append("</div>");
                    break;
                case RulesContent rules:
                    Open(section.Kind, "Rules");
                    Rows((rules.Rules ?? []).Select((r, i) => $"<span class=\"lead\">{i + 1}</span>{Titled(r.Title, r.Detail)}"), "ol");
                    Paragraph(rules.Note, "margin-top: 0.75rem");
                    break;
                case LinksContent links:
                    Open(section.Kind, "Submission and feedback");
                    _html.Append("<div class=\"card stack\"><p class=\"actions\">");
                    if (!string.IsNullOrWhiteSpace(links.SubmissionUrl))
                    {
                        _html.Append($"<a class=\"button\" href=\"{E(links.SubmissionUrl)}\">Submit your project</a>");
                    }

                    if (!string.IsNullOrWhiteSpace(links.FeedbackUrl))
                    {
                        _html.Append($"<a href=\"{E(links.FeedbackUrl)}\">Give feedback</a>");
                    }

                    _html.Append("</p>");
                    if (links.CodeFreezeAt is { } freeze)
                    {
                        _html.Append($"<p class=\"muted\">Code freeze at {Time(freeze)}</p>");
                    }

                    _html.Append("</div>");
                    break;
                case DemoFormatContent demo:
                    Open(section.Kind, "Demo format");
                    if (demo.Minutes is > 0 and var minutes)
                    {
                        var line = Minutes(minutes);
                        line = char.ToUpperInvariant(line[0]) + line[1..];
                        Paragraph(demo.QuestionMinutes is > 0 and var questions
                            ? $"{line} per team, then {Minutes(questions)} of questions."
                            : $"{line} per team.", "margin-bottom: 0.75rem");
                    }

                    var at = 0;
                    Rows((demo.Segments ?? []).Select(s =>
                    {
                        var from = at;
                        at += s.Seconds ?? 0;
                        return $"<span class=\"lead\">{Clock(from)} to {Clock(at)}</span>{Titled(s.Title, s.Detail)}";
                    }).ToList());
                    if (demo.Tips is { Count: > 0 } tips)
                    {
                        SubHeading("Tips");
                        Rows(tips.Select(E));
                    }

                    break;
                case JudgingContent judging:
                    var top = judging.TopScore ?? 5;
                    Open(section.Kind, "Judging and honors");
                    _html.Append($"<p style=\"margin-bottom: 0.75rem\">Judges score each team 1 to {top} on each criterion.</p>")
                        .Append("<div class=\"table\"><table><caption class=\"overline\">How judges score</caption><thead><tr>")
                        .Append($"<th scope=\"col\">Number</th><th scope=\"col\">Criterion</th><th scope=\"col\">The question</th><th scope=\"col\">Scores a {top} when</th></tr></thead><tbody>");
                    var c = 0;
                    foreach (var criterion in judging.Criteria ?? [])
                    {
                        c++;
                        _html.Append($"<tr><td>{c:00}</td><th scope=\"row\">{E(criterion.Title)} ({criterion.Weight}%)</th>")
                            .Append($"<td data-label=\"The question\">{E(criterion.Question)}</td><td data-label=\"Scores a {top} when\">{E(criterion.TopMark)}</td></tr>");
                    }

                    _html.Append("</tbody></table></div>");
                    if (judging.Honors is { Count: > 0 } honors)
                    {
                        SubHeading("Honors");
                        _html.Append("<div class=\"grid\">");
                        for (var i = 0; i < honors.Count; i++)
                        {
                            var honor = honors[i];
                            _html.Append($"<article class=\"card stack\"><p class=\"overline\">Honor {i + 1:00} · {E(ChosenBy.TryGetValue(honor.ChosenBy ?? string.Empty, out var chosen) ? chosen : honor.ChosenBy)}</p><h3>{E(honor.Title)}</h3>");
                            Paragraph(honor.Line);
                            _html.Append("</article>");
                        }

                        _html.Append("</div>");
                    }

                    Paragraph(judging.Note, "margin-top: 0.75rem");
                    break;
                case HubPeopleDto people:
                    Open(section.Kind, "People");
                    foreach (var (role, title) in PeopleGroups)
                    {
                        var group = people.People.Where(p => string.Equals(p.Role, role, StringComparison.OrdinalIgnoreCase)).ToList();
                        if (group.Count == 0)
                        {
                            continue;
                        }

                        SubHeading(title);
                        Rows(group.Select(p =>
                            (p.ProfileId is { } id && archive.Photos.TryGetValue(id, out var photo)
                                ? $"<img class=\"avatar\" src=\"{photo.Path}\" alt=\"\">"
                                : $"<span class=\"avatar\" aria-hidden=\"true\">{E(Initials(p.Name))}</span>")
                            + Titled(p.Name, p.Line)));
                    }

                    break;
                case WorshipContent worship:
                    Open(section.Kind, "Worship");
                    Paragraph(worship.Note, "margin-bottom: 0.75rem");
                    Rows((worship.Songs ?? []).Select((s, i) =>
                        $"<span class=\"lead\">{i + 1}</span>{Titled(s.Title, s.Artist)}"
                        + (string.IsNullOrWhiteSpace(s.Url) ? string.Empty : $"<a class=\"end\" href=\"{E(s.Url)}\">Listen ahead</a>")), "ol");
                    break;
                case HubSlidesDto slides:
                    Open(section.Kind, "Slides");
                    _html.Append("<ol class=\"plain grid\">");
                    var number = 0;
                    foreach (var slide in slides.Slides)
                    {
                        if (FilePath(slide.ResourceId) is not { } file)
                        {
                            continue;
                        }

                        number++;
                        _html.Append(slide.Kind == HubFiles.Pdf
                            ? $"<li class=\"card\"><a href=\"{file}\">{number}. {E(slide.Title)} (PDF)</a></li>"
                            : $"<li><figure><a href=\"{file}\"><img src=\"{file}\" alt=\"Slide {number}: {E(slide.Title)}\"></a><figcaption>{number}. {E(slide.Title)}</figcaption></figure></li>");
                    }

                    _html.Append("</ol>");
                    break;
                case GivingContent giving:
                    Open(section.Kind, "Giving");
                    _html.Append("<div class=\"card stack\">");
                    Paragraph(giving.Line);
                    if (_hub.Organisation is { } organisation)
                    {
                        if (!string.IsNullOrWhiteSpace(organisation.GivingText))
                        {
                            _html.Append($"<p class=\"muted\">{E(organisation.GivingText)}</p>");
                        }

                        if (!string.IsNullOrWhiteSpace(organisation.GivingLink))
                        {
                            _html.Append($"<p><a class=\"button\" href=\"{E(organisation.GivingLink)}\">Give to {E(organisation.ShortName)}</a></p>");
                        }
                    }

                    _html.Append("</div>");
                    break;
                case UpcomingEventsContent:
                    Open(section.Kind, "Upcoming events");
                    var origin = new Uri(_hub.Link).GetLeftPart(UriPartial.Authority);
                    Rows((_hub.UpcomingEvents ?? []).Select(u =>
                        $"<span class=\"lead\">{Day(u.StartsAt, year: false)}</span><div><a href=\"{E($"{origin}/public/events/{u.Id}")}\"><strong>{E(u.Title)}</strong></a>"
                        + $"<p class=\"muted\">{E(Local(u.StartsAt).Date == Local(u.EndsAt).Date ? Times(u.StartsAt, u.EndsAt) : Range(u.StartsAt, u.EndsAt))}"
                        + $"{(u.Format == "Online" ? " · Online" : u.Venue is { Length: > 0 } where ? $" · {E(where)}" : string.Empty)}</p></div>"));
                    break;
                default:
                    return;
            }

            Close();
        }
    }
}
