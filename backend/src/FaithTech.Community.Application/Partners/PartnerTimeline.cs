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
}

/// <summary>Reads a partner's shared timeline (L2-086). Every lead role, Staff and System Admin see the same one.</summary>
public class PartnerTimelineHandler(IApplicationDbContext db, PartnerAccess access, PartnerTimelineViews views)
{
    public async Task<(Result Result, PartnerActivityPageDto? Page)> ListAsync(Guid partnerId, CancellationToken cancellationToken = default)
    {
        if (!access.CanRead)
        {
            return (Result.Forbidden(), null);
        }

        var partner = await db.Partners.AsNoTracking().SingleOrDefaultAsync(p => p.Id == partnerId, cancellationToken);
        if (partner is null)
        {
            return (Result.NotFound(), null);
        }

        var rows = await PartnerTimelineOrder.Newest(db.PartnerActivities.AsNoTracking().Where(a => a.PartnerId == partnerId))
            .ToListAsync(cancellationToken);
        return (Result.Ok(), new PartnerActivityPageDto(await views.ToDtosAsync(partner, rows, cancellationToken), null));
    }
}

public class PartnerTimelineViews(IApplicationDbContext db)
{
    public static bool TryParseLogged(string? value, out PartnerActivityKind kind) =>
        Enum.TryParse(value, ignoreCase: false, out kind) && PartnerActivityKinds.Logged.Contains(kind);

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

    private static string Text(Partner partner, PartnerActivity activity) => activity.Summary ?? string.Empty;
}
