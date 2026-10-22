using System.Diagnostics.CodeAnalysis;
using System.Globalization;
using System.Text;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Partners;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Partners;

/// <summary>One timeline entry. Text is the sentence the page shows; Summary is what was logged.</summary>
public record PartnerActivityDto(
    Guid Id,
    string Kind,
    string? Summary,
    string Text,
    DateOnly OccurredOn,
    TimeOnly? OccurredAt,
    string? NextStep,
    DateOnly? NextStepDue,
    Guid LoggedById,
    string LoggedByName,
    DateTime LoggedAtUtc,
    string? FromStage,
    string? ToStage);

/// <summary>A page of the timeline, newest first.</summary>
public record PartnerActivityPageDto(IReadOnlyList<PartnerActivityDto> Items, string? Before);

/// <summary>The one order every timeline query uses (L2-086 AC2): date, time (none as 00:00), log time, id.</summary>
public static class PartnerTimelineOrder
{
    public static IOrderedQueryable<PartnerActivity> Newest(IQueryable<PartnerActivity> activities) =>
        activities
            .OrderByDescending(a => a.OccurredOn)
            .ThenByDescending(a => a.OccurredAt ?? TimeOnly.MinValue)
            .ThenByDescending(a => a.LoggedAtUtc)
            .ThenByDescending(a => a.Id);

    /// <summary>The entries after the cursor in this order, so "Show older" never repeats or skips one (L2-086 AC4).</summary>
    public static IQueryable<PartnerActivity> OlderThan(IQueryable<PartnerActivity> activities, TimelineCursor cursor)
    {
        var at = cursor.OccurredAt ?? TimeOnly.MinValue;
        return activities.Where(a =>
            a.OccurredOn < cursor.OccurredOn
            || (a.OccurredOn == cursor.OccurredOn && (a.OccurredAt ?? TimeOnly.MinValue) < at)
            || (a.OccurredOn == cursor.OccurredOn && (a.OccurredAt ?? TimeOnly.MinValue) == at && a.LoggedAtUtc < cursor.LoggedAtUtc)
            || (a.OccurredOn == cursor.OccurredOn && (a.OccurredAt ?? TimeOnly.MinValue) == at && a.LoggedAtUtc == cursor.LoggedAtUtc
                && a.Id.CompareTo(cursor.Id) < 0));
    }
}

/// <summary>Maps the `kind` query value to the kinds it lists: one logged kind, or Stage for the system entries.</summary>
public static class PartnerTimelineFilter
{
    public static bool TryParse(string? kind, out PartnerActivityKind[]? kinds)
    {
        kinds = null;
        if (string.IsNullOrEmpty(kind))
        {
            return true;
        }

        if (kind == "Stage")
        {
            kinds = PartnerActivityKinds.Stage;
            return true;
        }

        if (PartnerTimelineViews.TryParseLogged(kind, out var logged))
        {
            kinds = [logged];
            return true;
        }

        return false;
    }
}

/// <summary>Reads a partner's shared timeline (L2-086). Every lead role, Staff and System Admin see the same one.</summary>
public class PartnerTimelineHandler(IApplicationDbContext db, PartnerAccess access, PartnerTimelineViews views)
{
    public const int PageSize = 50;

    public async Task<(Result Result, PartnerActivityPageDto? Page)> ListAsync(
        Guid partnerId, string? kind = null, string? before = null, CancellationToken cancellationToken = default)
    {
        if (!access.CanRead)
        {
            return (Result.Forbidden(), null);
        }

        if (!PartnerTimelineFilter.TryParse(kind, out var kinds))
        {
            return (Result.Invalid("kind", "Choose Call, Email, Meeting, Note or Stage."), null);
        }

        TimelineCursor? cursor = null;
        if (before is not null && !TimelineCursor.TryDecode(before, out cursor))
        {
            return (Result.Invalid("before", "That page of the timeline no longer exists. Reload the partner."), null);
        }

        var partner = await db.Partners.AsNoTracking().SingleOrDefaultAsync(p => p.Id == partnerId, cancellationToken);
        if (partner is null)
        {
            return (Result.NotFound(), null);
        }

        var query = db.PartnerActivities.AsNoTracking().Where(a => a.PartnerId == partnerId);
        if (kinds is not null)
        {
            query = query.Where(a => kinds.Contains(a.Kind));
        }

        if (cursor is not null)
        {
            query = PartnerTimelineOrder.OlderThan(query, cursor);
        }

        var rows = await PartnerTimelineOrder.Newest(query).Take(PageSize + 1).ToListAsync(cancellationToken);
        var page = rows.Take(PageSize).ToList();
        var next = rows.Count > PageSize ? TimelineCursor.Of(page[^1]).Encode() : null;
        return (Result.Ok(), new PartnerActivityPageDto(await views.ToDtosAsync(partner, page, cancellationToken), next));
    }
}

public class PartnerTimelineViews(IApplicationDbContext db)
{
    public static bool TryParseLogged(string? value, out PartnerActivityKind kind) =>
        Enum.TryParse(value, ignoreCase: false, out kind) && Enum.IsDefined(kind) && PartnerActivityKinds.Logged.Contains(kind);

    public async Task<IReadOnlyList<PartnerActivityDto>> ToDtosAsync(
        Partner partner, IReadOnlyList<PartnerActivity> activities, CancellationToken cancellationToken = default)
    {
        var people = activities.Select(a => a.LoggedById).Distinct().ToList();
        var names = await db.Profiles.AsNoTracking().Where(p => people.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id, p => p.Name, cancellationToken);
        return
        [
            .. activities.Select(a => new PartnerActivityDto(
                a.Id,
                a.Kind.ToString(),
                a.Summary,
                Text(partner, a),
                a.OccurredOn,
                a.OccurredAt,
                a.NextStep,
                a.NextStepDue,
                a.LoggedById,
                names.GetValueOrDefault(a.LoggedById, "A former member"),
                a.LoggedAtUtc,
                a.FromStage?.ToString(),
                a.ToStage?.ToString())),
        ];
    }

    /// <summary>The sentence the timeline shows, with the partner's current name.</summary>
    private static string Text(Partner partner, PartnerActivity activity) => activity.Kind switch
    {
        PartnerActivityKind.Added when activity.ToStage is null or PartnerStage.Lead => $"Added {partner.Name} as a lead",
        PartnerActivityKind.Added => $"Added {partner.Name} at {StageLabel(activity.ToStage!.Value)}",
        PartnerActivityKind.StageMoved =>
            $"Moved {partner.Name} from {StageLabel(activity.FromStage!.Value)} to {StageLabel(activity.ToStage!.Value)}"
            + (activity.Summary is { } note ? $": “{note}”" : string.Empty),
        _ => activity.Summary ?? string.Empty,
    };

    public static string StageLabel(PartnerStage stage) => stage switch
    {
        PartnerStage.Lead => "Lead",
        PartnerStage.InFunnel => "In funnel",
        _ => "Confirmed",
    };
}

/// <summary>The "before" value of a timeline page: the oldest entry shown, as opaque base64url.</summary>
public record TimelineCursor(DateOnly OccurredOn, TimeOnly? OccurredAt, DateTime LoggedAtUtc, Guid Id)
{
    public static TimelineCursor Of(PartnerActivity activity) =>
        new(activity.OccurredOn, activity.OccurredAt, activity.LoggedAtUtc, activity.Id);

    public string Encode()
    {
        var raw = $"{OccurredOn:yyyy-MM-dd}|{OccurredAt?.ToString("HH:mm:ss.fffffff", CultureInfo.InvariantCulture)}|{LoggedAtUtc.Ticks}|{Id}";
        return Convert.ToBase64String(Encoding.UTF8.GetBytes(raw)).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }

    public static bool TryDecode(string? value, [NotNullWhen(true)] out TimelineCursor? cursor)
    {
        cursor = null;
        if (string.IsNullOrEmpty(value))
        {
            return false;
        }

        try
        {
            var base64 = value.Replace('-', '+').Replace('_', '/');
            var raw = Encoding.UTF8.GetString(Convert.FromBase64String(base64.PadRight(base64.Length + ((4 - (base64.Length % 4)) % 4), '=')));
            var parts = raw.Split('|');
            if (parts.Length != 4
                || !DateOnly.TryParseExact(parts[0], "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var on)
                || !long.TryParse(parts[2], NumberStyles.None, CultureInfo.InvariantCulture, out var ticks)
                || ticks < DateTime.MinValue.Ticks || ticks > DateTime.MaxValue.Ticks
                || !Guid.TryParse(parts[3], out var id))
            {
                return false;
            }

            TimeOnly? at = null;
            if (parts[1].Length > 0)
            {
                if (!TimeOnly.TryParseExact(parts[1], "HH:mm:ss.fffffff", CultureInfo.InvariantCulture, DateTimeStyles.None, out var time))
                {
                    return false;
                }

                at = time;
            }

            cursor = new TimelineCursor(on, at, new DateTime(ticks, DateTimeKind.Utc), id);
            return true;
        }
        catch (FormatException)
        {
            return false;
        }
    }
}
