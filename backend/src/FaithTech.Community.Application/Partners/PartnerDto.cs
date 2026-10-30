using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Partners;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Partners;

/// <summary>
/// A partner record. Stage is Lead, InFunnel or Confirmed. LastActivityOn is the latest timeline
/// entry's date; NextStep is the latest logged activity's next step (L2-111 AC6, AC7).
/// </summary>
public record PartnerDto(
    Guid Id,
    string Name,
    string? Website,
    string? Offering,
    Guid? OwnerId,
    string? OwnerName,
    string? ContactName,
    string? Email,
    string? Phone,
    string? Notes,
    string Stage,
    bool CanEdit,
    DateOnly? LastActivityOn,
    string? NextStep,
    DateOnly? NextStepDue,
    bool CanLogActivity,
    int Version,
    PartnerArchivedDto? Archived,
    bool CanRestore);

/// <summary>Who merged an archived partner, when and into which partner (L2-114 AC7); MergedIntoVersion feeds a restore.</summary>
public record PartnerArchivedDto(
    Guid MergedIntoId,
    string MergedIntoName,
    int MergedIntoVersion,
    Guid MergedById,
    string MergedByName,
    DateTime MergedAtUtc);

public record PartnerCardDto(Guid Id, string Name, string? ContactName, string? Offering, string? NextStep = null, DateOnly? NextStepDue = null);

public record PartnerColumnDto(string Stage, int Count, IReadOnlyList<PartnerCardDto> Cards);

/// <summary>The board: the three stages in order with their counts (L2-018 AC1).</summary>
public record PartnerBoardDto(IReadOnlyList<PartnerColumnDto> Columns, bool CanEdit);

public record PartnerOwnerDto(Guid ProfileId, string Name);

public class PartnerViews(IApplicationDbContext db, PartnerAccess access)
{
    public async Task<PartnerDto> ToDtoAsync(Partner partner, CancellationToken cancellationToken = default)
    {
        var ownerName = partner.OwnerId is { } owner
            ? await db.Profiles.AsNoTracking().Where(p => p.Id == owner).Select(p => p.Name).SingleOrDefaultAsync(cancellationToken)
            : null;
        var activities = db.PartnerActivities.AsNoTracking().Where(a => a.PartnerId == partner.Id);
        var last = await PartnerTimelineOrder.Newest(activities).Select(a => (DateOnly?)a.OccurredOn).FirstOrDefaultAsync(cancellationToken);
        var next = await PartnerTimelineOrder.Newest(activities.Where(a => a.NextStep != null))
            .Select(a => new { a.NextStep, a.NextStepDue })
            .FirstOrDefaultAsync(cancellationToken);
        PartnerArchivedDto? archived = null;
        if (partner.MergedIntoId is { } keptId)
        {
            var kept = await db.Partners.AsNoTracking().Where(p => p.Id == keptId)
                .Select(p => new { p.Name, p.Version }).SingleAsync(cancellationToken);
            var by = await db.Profiles.AsNoTracking().Where(p => p.Id == partner.MergedById)
                .Select(p => p.Name).SingleOrDefaultAsync(cancellationToken);
            archived = new PartnerArchivedDto(keptId, kept.Name, kept.Version, partner.MergedById ?? Guid.Empty,
                by ?? "A former member", partner.MergedAtUtc ?? partner.ArchivedAtUtc!.Value);
        }

        var canWrite = access.CanWrite && !partner.IsArchived;
        return new PartnerDto(
            partner.Id,
            partner.Name,
            partner.Website,
            partner.Offering,
            partner.OwnerId,
            ownerName,
            partner.ContactName,
            partner.Email,
            partner.Phone,
            partner.Notes,
            partner.Stage.ToString(),
            canWrite,
            last,
            next?.NextStep,
            next?.NextStepDue,
            canWrite,
            partner.Version,
            archived,
            access.CanRestore && partner.IsArchived);
    }
}
