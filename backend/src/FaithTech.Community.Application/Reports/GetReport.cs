using System.Globalization;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Organisations;
using FaithTech.Community.Domain.Events;
using FaithTech.Community.Domain.Partners;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Reports;

/// <summary>
/// The filters from <c>?chapter=&amp;period=</c>: a chapter's id and a period key; empty means All {chapters} and Last
/// 30 days. The chapter is ignored while chapters are off (L2-142 AC3).
/// </summary>
public record GetReportQuery(string? Chapter, string? Period);

/// <summary>
/// Computes the report (L2-123 to L2-127) from the definitions in ADR 0030. Every figure is a database aggregate:
/// a <c>CountAsync</c> or a <c>GroupBy</c>/<c>Count</c> projection, with correlated counts for the events table, so
/// no query runs per row and no entity is loaded to be counted (L2-129 AC2). Shaping runs in memory over at most one
/// row per chapter, stage or month. Private contacts, their notes and pending connections are never read (L2-125 AC6).
/// </summary>
public class GetReportHandler(IApplicationDbContext db, ReportAccess access, TimeProvider time, ICurrentOrganisation organisation)
{
    public const string Other = "Other";
    /// <summary>The single pipeline row while chapters are off.</summary>
    public const string WholePipeline = "Partner pipeline";
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

        var label = organisation.ChapterLabelSingular;
        var chapters = label is null ? [] : await ChaptersAsync(cancellationToken);
        ReportChapterDto? chapter = null;
        if (label is not null && !string.IsNullOrEmpty(query.Chapter))
        {
            chapter = Guid.TryParse(query.Chapter, out var id) ? chapters.FirstOrDefault(c => c.Id == id) : null;
            if (chapter is null)
            {
                return (Result.Invalid("chapter", $"Choose a {label.ToLowerInvariant()} from the list."), null);
            }
        }

        var members = Members();
        var events = db.Events.AsNoTracking();
        if (chapter is not null)
        {
            members = members.Where(p => p.ChapterId == chapter.Id);
            events = events.Where(e => e.ChapterId == chapter.Id);
        }

        var membersFigure = await MembersAsync(members, window, cancellationToken);
        var (eventsHeld, rsvps) = await EventFiguresAsync(events, window, cancellationToken);
        var noChapter = label is null ? WholePipeline : $"No {label.ToLowerInvariant()}";
        var pipeline = await PartnerPipelineAsync(chapter, chapters, noChapter, cancellationToken);
        var partners = new PartnersFigureDto(pipeline.Sum(r => r.Confirmed), pipeline.Sum(r => r.Lead + r.InFunnel + r.Confirmed));
        var announcements = new AnnouncementsFigureDto(await AnnouncementsAsync(chapter?.Id, window, cancellationToken));
        List<ReportChartRowDto> membersByChapter = label is null
            ? []
            : await MembersByChapterAsync(members, chapter?.Name, membersFigure.Value, cancellationToken);
        var newMembersByMonth = await NewMembersByMonthAsync(members, window, cancellationToken);
        var eventRows = await EventRowsAsync(events, window, label is null ? null : $"{organisation.ShortName}-wide", cancellationToken);

        return (Result.Ok(), new ReportDto(
            chapter?.Id,
            chapter?.Name,
            window.Key,
            window.From,
            window.To,
            chapters,
            membersFigure.Value == 0 && eventRows.Count == 0,
            new ReportFiguresDto(membersFigure, eventsHeld, rsvps, partners, announcements),
            membersByChapter,
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

    /// <summary>The organisation's active chapters in its order (L2-142 AC1).</summary>
    private Task<List<ReportChapterDto>> ChaptersAsync(CancellationToken cancellationToken) =>
        db.Chapters.AsNoTracking()
            .Where(c => c.ArchivedAtUtc == null)
            .OrderBy(c => c.SortOrder).ThenBy(c => c.Name)
            .Select(c => new ReportChapterDto(c.Id, c.Name))
            .ToListAsync(cancellationToken);

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

    /// <summary>
    /// Lead, In funnel and Confirmed per owner's home chapter; the period does not apply (ADR 0030). Under All
    /// {chapters}: every active chapter in order, then any archived owner chapter by name, then "No {chapter}" when it
    /// has partners. While chapters are off (every owner then has no visible chapter) the one row is the whole pipeline.
    /// </summary>
    private async Task<List<PartnerPipelineRowDto>> PartnerPipelineAsync(
        ReportChapterDto? chapter, List<ReportChapterDto> chapters, string noChapter, CancellationToken cancellationToken)
    {
        var groups = await (
                from p in db.Partners.AsNoTracking()
                where p.ArchivedAtUtc == null
                join o in db.Profiles on p.OwnerId equals (Guid?)o.Id into owners
                from o in owners.DefaultIfEmpty()
                group p by new
                {
                    ChapterId = o == null || o.Chapter == null ? (Guid?)null : o.Chapter.Id,
                    Name = o == null || o.Chapter == null ? null : o.Chapter.Name,
                    p.Stage,
                } into g
                select new { g.Key.ChapterId, g.Key.Name, g.Key.Stage, Count = g.Count() })
            .ToListAsync(cancellationToken);

        PartnerPipelineRowDto Row(string name, Guid? id)
        {
            var stages = groups.Where(g => g.ChapterId == id).ToList();
            int Count(PartnerStage stage) => stages.Where(s => s.Stage == stage).Sum(s => s.Count);
            return new PartnerPipelineRowDto(name, Count(PartnerStage.Lead), Count(PartnerStage.InFunnel), Count(PartnerStage.Confirmed));
        }

        if (chapter is not null)
        {
            return [Row(chapter.Name, chapter.Id)];
        }

        var rows = chapters.Select(c => Row(c.Name, c.Id)).ToList();
        var archived = groups
            .Where(g => g.ChapterId is { } id && chapters.All(c => c.Id != id))
            .Select(g => (Id: g.ChapterId, Name: g.Name!))
            .Distinct()
            .OrderBy(g => g.Name, StringComparer.OrdinalIgnoreCase);
        rows.AddRange(archived.Select(a => Row(a.Name, a.Id)));
        if (groups.Any(g => g.ChapterId is null) || noChapter == WholePipeline)
        {
            rows.Add(Row(noChapter, null));
        }

        return rows;
    }

    /// <summary>Announcements sent in the window; one chapter means the sender's chapter.</summary>
    private Task<int> AnnouncementsAsync(Guid? chapterId, ReportWindow window, CancellationToken cancellationToken)
    {
        var announcements = db.Announcements.AsNoTracking().Where(a => a.SentAt <= window.To);
        if (window.From is { } from)
        {
            announcements = announcements.Where(a => a.SentAt >= from);
        }

        if (chapterId is not null)
        {
            announcements = announcements.Where(a => db.Profiles.Any(s => s.Id == a.SenderId && s.ChapterId == chapterId));
        }

        return announcements.CountAsync(cancellationToken);
    }

    /// <summary>The four chapters with most members (ties by name) and "Other" for the rest and members with none.</summary>
    private static async Task<List<ReportChartRowDto>> MembersByChapterAsync(
        IQueryable<Profile> members, string? chapter, int total, CancellationToken cancellationToken)
    {
        if (chapter is not null)
        {
            return [new ReportChartRowDto(chapter, total)];
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
        IQueryable<Event> events, ReportWindow window, string? organisationWide, CancellationToken cancellationToken)
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
