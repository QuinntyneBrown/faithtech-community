using System.Globalization;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Organisations;
using FaithTech.Community.Domain.Events;
using FaithTech.Community.Domain.Partners;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Reports;

/// <summary>The filters from <c>?city=&amp;period=</c>; empty means All cities and Last 30 days.</summary>
public record GetReportQuery(string? City, string? Period);

/// <summary>
/// Computes the report (L2-123 to L2-127) from the definitions in ADR 0030. Every figure is a database aggregate:
/// a <c>CountAsync</c> or a <c>GroupBy</c>/<c>Count</c> projection, with correlated counts for the events table, so
/// no query runs per row and no entity is loaded to be counted (L2-129 AC2). Shaping runs in memory over at most one
/// row per city, stage or month. Private contacts, their notes and pending connections are never read (L2-125 AC6).
/// </summary>
public class GetReportHandler(IApplicationDbContext db, ReportAccess access, TimeProvider time, ICurrentOrganisation organisation)
{
    public const string NoCity = "No city";
    public const string Other = "Other";
    public const int MaxEvents = 50;
    public const int MaxMonths = 12;
    public static readonly TimeSpan UpcomingHorizon = TimeSpan.FromDays(30);

    public async Task<(Result Result, ReportDto? Report)> HandleAsync(GetReportQuery query, CancellationToken cancellationToken = default)
    {
        if (!access.CanRead)
        {
            return (Result.Forbidden(), null);
        }

        if (ReportPeriod.Resolve(query.Period, time) is not { } window)
        {
            return (Result.Invalid("period", "Choose Last 30 days, Last 90 days, This year or All time."), null);
        }

        var cities = await CitiesAsync(cancellationToken);
        var city = string.IsNullOrEmpty(query.City) ? null : query.City;
        if (city is not null && !cities.Contains(city, StringComparer.Ordinal))
        {
            return (Result.Invalid("city", "Choose a city from the list."), null);
        }

        var members = Members();
        var events = db.Events.AsNoTracking();
        if (city is not null)
        {
            members = members.Where(p => p.Chapter != null && p.Chapter.Name == city);
            events = events.Where(e => e.Chapter != null && e.Chapter.Name == city);
        }

        var membersFigure = await MembersAsync(members, window, cancellationToken);
        var (eventsHeld, rsvps) = await EventFiguresAsync(events, window, cancellationToken);
        var pipeline = await PartnerPipelineAsync(city, cities, cancellationToken);
        var partners = new PartnersFigureDto(pipeline.Sum(r => r.Confirmed), pipeline.Sum(r => r.Lead + r.InFunnel + r.Confirmed));
        var announcements = new AnnouncementsFigureDto(await AnnouncementsAsync(city, window, cancellationToken));
        var membersByCity = await MembersByCityAsync(members, city, membersFigure.Value, cancellationToken);
        var newMembersByMonth = await NewMembersByMonthAsync(members, window, cancellationToken);
        var eventRows = await EventRowsAsync(events, window, $"{organisation.ShortName}-wide", cancellationToken);

        return (Result.Ok(), new ReportDto(
            city,
            window.Key,
            window.From,
            window.To,
            cities,
            membersFigure.Value == 0 && eventRows.Count == 0,
            new ReportFiguresDto(membersFigure, eventsHeld, rsvps, partners, announcements),
            membersByCity,
            newMembersByMonth,
            pipeline,
            eventRows));
    }

    /// <summary>Profiles whose account has a verified email and is not suspended.</summary>
    private IQueryable<Profile> Members() =>
        from p in db.Profiles.AsNoTracking()
        join u in db.Users on p.UserId equals (Guid?)u.Id
        where u.EmailConfirmed && !p.IsSuspended
        select p;

    /// <summary>
    /// The chapters that tag a member or an event, by name, ordinal-ignore-case sorted; the city filter matches these
    /// names until the chapter filter replaces it (slice 20).
    /// </summary>
    private async Task<List<string>> CitiesAsync(CancellationToken cancellationToken)
    {
        var homeCities = await Members().Where(p => p.Chapter != null)
            .Select(p => p.Chapter!.Name).Distinct().ToListAsync(cancellationToken);
        var eventCities = await db.Events.Where(e => e.Chapter != null)
            .Select(e => e.Chapter!.Name).Distinct().ToListAsync(cancellationToken);
        return homeCities.Union(eventCities, StringComparer.Ordinal).Order(StringComparer.OrdinalIgnoreCase).ToList();
    }

    private static IQueryable<Event> StartingIn(IQueryable<Event> events, ReportWindow window) =>
        window.From is { } from
            ? events.Where(e => e.StartsAt >= from && e.StartsAt <= window.To)
            : events.Where(e => e.StartsAt <= window.To);

    private static async Task<MembersFigureDto> MembersAsync(IQueryable<Profile> members, ReportWindow window, CancellationToken cancellationToken)
    {
        var value = await members.CountAsync(cancellationToken);
        if (window.From is not { } from)
        {
            return new MembersFigureDto(value, null);
        }

        var (start, end) = (from.UtcDateTime, window.To.UtcDateTime);
        var joined = await members.CountAsync(p => p.JoinedAtUtc != null && p.JoinedAtUtc >= start && p.JoinedAtUtc <= end, cancellationToken);
        return new MembersFigureDto(value, joined);
    }

    private static async Task<(EventsHeldFigureDto EventsHeld, RsvpsFigureDto Rsvps)> EventFiguresAsync(
        IQueryable<Event> events, ReportWindow window, CancellationToken cancellationToken)
    {
        var inWindow = StartingIn(events, window);
        var held = inWindow.Where(e => !e.IsCancelled);
        var heldCount = await held.CountAsync(cancellationToken);
        var cancelled = await inWindow.CountAsync(e => e.IsCancelled, cancellationToken);
        var rsvps = held.SelectMany(e => e.Rsvps).Where(r => !r.IsWalkIn);
        var rsvpCount = await rsvps.CountAsync(cancellationToken);
        var checkedIn = await rsvps.CountAsync(r => r.CheckedInAt != null, cancellationToken);
        return (new EventsHeldFigureDto(heldCount, cancelled), new RsvpsFigureDto(rsvpCount, checkedIn, Percent(checkedIn, rsvpCount)));
    }

    /// <summary>Lead, In funnel and Confirmed per owner's chapter; the period does not apply (ADR 0030).</summary>
    private async Task<List<PartnerPipelineRowDto>> PartnerPipelineAsync(string? city, List<string> cities, CancellationToken cancellationToken)
    {
        var groups = await (
                from p in db.Partners.AsNoTracking()
                where p.ArchivedAtUtc == null
                join o in db.Profiles on p.OwnerId equals (Guid?)o.Id into owners
                from o in owners.DefaultIfEmpty()
                group p by new { City = o == null || o.Chapter == null ? null : o.Chapter.Name, p.Stage } into g
                select new { g.Key.City, g.Key.Stage, Count = g.Count() })
            .ToListAsync(cancellationToken);
        var byCity = groups
            .GroupBy(g => string.IsNullOrWhiteSpace(g.City) ? NoCity : g.City, StringComparer.Ordinal)
            .ToDictionary(g => g.Key, g => g.ToList(), StringComparer.Ordinal);

        PartnerPipelineRowDto Row(string name)
        {
            var stages = byCity.GetValueOrDefault(name) ?? [];
            int Count(PartnerStage stage) => stages.Where(s => s.Stage == stage).Sum(s => s.Count);
            return new PartnerPipelineRowDto(name, Count(PartnerStage.Lead), Count(PartnerStage.InFunnel), Count(PartnerStage.Confirmed));
        }

        if (city is not null)
        {
            return [Row(city)];
        }

        var named = cities.Union(byCity.Keys.Where(k => k != NoCity), StringComparer.Ordinal).Order(StringComparer.OrdinalIgnoreCase);
        var rows = named.Select(Row).ToList();
        if (byCity.ContainsKey(NoCity))
        {
            rows.Add(Row(NoCity));
        }

        return rows;
    }

    /// <summary>Announcements sent in the window; one chapter means the sender's chapter.</summary>
    private Task<int> AnnouncementsAsync(string? city, ReportWindow window, CancellationToken cancellationToken)
    {
        var announcements = db.Announcements.AsNoTracking().Where(a => a.SentAt <= window.To);
        if (window.From is { } from)
        {
            announcements = announcements.Where(a => a.SentAt >= from);
        }

        if (city is not null)
        {
            announcements = announcements.Where(a => db.Profiles.Any(s => s.Id == a.SenderId && s.Chapter != null && s.Chapter.Name == city));
        }

        return announcements.CountAsync(cancellationToken);
    }

    /// <summary>The four cities with most members (ties by name) and "Other" for the rest and blank cities.</summary>
    private static async Task<List<ReportChartRowDto>> MembersByCityAsync(
        IQueryable<Profile> members, string? city, int total, CancellationToken cancellationToken)
    {
        if (city is not null)
        {
            return [new ReportChartRowDto(city, total)];
        }

        var groups = await members.GroupBy(p => p.Chapter == null ? null : p.Chapter.Name).Select(g => new { City = g.Key, Count = g.Count() }).ToListAsync(cancellationToken);
        var top = groups
            .Where(g => !string.IsNullOrWhiteSpace(g.City))
            .OrderByDescending(g => g.Count)
            .ThenBy(g => g.City, StringComparer.OrdinalIgnoreCase)
            .Take(4)
            .Select(g => new ReportChartRowDto(g.City!, g.Count))
            .ToList();
        var other = groups.Sum(g => g.Count) - top.Sum(r => r.Value);
        if (other > 0)
        {
            top.Add(new ReportChartRowDto(Other, other));
        }

        return top;
    }

    /// <summary>
    /// Every UTC calendar month the window touches (for All time, from the first join), the last 12 at most, with
    /// empty months as 0 and the current month marked "so far".
    /// </summary>
    private static async Task<List<ReportMonthRowDto>> NewMembersByMonthAsync(
        IQueryable<Profile> members, ReportWindow window, CancellationToken cancellationToken)
    {
        var to = window.To.UtcDateTime;
        var current = new DateTime(to.Year, to.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var first = window.From?.UtcDateTime
            ?? await members.Where(p => p.JoinedAtUtc != null).MinAsync(p => p.JoinedAtUtc, cancellationToken)
            ?? current;
        var firstMonth = new DateTime(first.Year, first.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        if (firstMonth < current.AddMonths(-(MaxMonths - 1)))
        {
            firstMonth = current.AddMonths(-(MaxMonths - 1));
        }

        var start = window.From?.UtcDateTime is { } from && from > firstMonth ? from : firstMonth;
        var counts = await members
            .Where(p => p.JoinedAtUtc != null && p.JoinedAtUtc >= start && p.JoinedAtUtc <= to)
            .GroupBy(p => new { p.JoinedAtUtc!.Value.Year, p.JoinedAtUtc!.Value.Month })
            .Select(g => new { g.Key.Year, g.Key.Month, Count = g.Count() })
            .ToListAsync(cancellationToken);

        var months = new List<DateTime>();
        for (var month = firstMonth; month <= current; month = month.AddMonths(1))
        {
            months.Add(month);
        }

        var format = months.All(m => m.Year == current.Year) ? "MMM" : "MMM yyyy";
        return months.Select(m => new ReportMonthRowDto(
                m.ToString("yyyy-MM", CultureInfo.InvariantCulture),
                m.ToString(format, CultureInfo.InvariantCulture),
                counts.Where(c => c.Year == m.Year && c.Month == m.Month).Sum(c => c.Count),
                m == current))
            .ToList();
    }

    /// <summary>Events from the start of the window to 30 days after now, newest first, at most 50.</summary>
    private static async Task<List<ReportEventRowDto>> EventRowsAsync(
        IQueryable<Event> events, ReportWindow window, string organisationWide, CancellationToken cancellationToken)
    {
        var until = window.To + UpcomingHorizon;
        var listed = window.From is { } from ? events.Where(e => e.StartsAt >= from) : events;
        var rows = await listed
            .Where(e => e.StartsAt <= until)
            .OrderByDescending(e => e.StartsAt)
            .Take(MaxEvents)
            .Select(e => new
            {
                e.Id,
                e.Title,
                e.StartsAt,
                City = e.Chapter == null ? organisationWide : e.Chapter.Name,
                e.IsCancelled,
                Going = e.Rsvps.Count(r => !r.IsWalkIn),
                CheckedIn = e.Rsvps.Count(r => !r.IsWalkIn && r.CheckedInAt != null),
            })
            .ToListAsync(cancellationToken);
        return rows.Select(e => e.IsCancelled
                ? new ReportEventRowDto(e.Id, e.Title, e.StartsAt, e.City, "Cancelled", null, null, null)
                : e.StartsAt > window.To
                    ? new ReportEventRowDto(e.Id, e.Title, e.StartsAt, e.City, "Upcoming", e.Going, null, null)
                    : new ReportEventRowDto(e.Id, e.Title, e.StartsAt, e.City, "Held", e.Going, e.CheckedIn, Percent(e.CheckedIn, e.Going)))
            .ToList();
    }

    /// <summary>A whole percentage, rounded half away from zero; null when there is nothing to divide by.</summary>
    public static int? Percent(int part, int whole) =>
        whole == 0 ? null : (int)Math.Round(100m * part / whole, MidpointRounding.AwayFromZero);
}
