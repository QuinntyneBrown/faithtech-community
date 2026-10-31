using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Partners;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Partners;

/// <summary>
/// A partner record. Stage is the stage key and StageName its current name, with "(archived)" once archived (L2-144 AC6). LastActivityOn is the latest timeline
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
    bool CanRestore,
    string? StageName = null,
    string? StageKind = null);

/// <summary>Who merged an archived partner, when and into which partner (L2-114 AC7); MergedIntoVersion feeds a restore.</summary>
public record PartnerArchivedDto(
    Guid MergedIntoId,
    string MergedIntoName,
    int MergedIntoVersion,
    Guid MergedById,
    string MergedByName,
    DateTime MergedAtUtc);

public record PartnerCardDto(Guid Id, string Name, string? ContactName, string? Offering, string? NextStep = null, DateOnly? NextStepDue = null);

/// <summary>
/// A board column: the stage's key, its partners and their count, and the stage's id, name, kind (Open or Confirmed)
/// and whether it is archived, for the "Archived stage: {name}" column (L2-144 AC3, AC4).
/// </summary>
public record PartnerColumnDto(
    string Stage, int Count, IReadOnlyList<PartnerCardDto> Cards, Guid StageId, string Name, string Kind, bool Archived);

/// <summary>The board: the organisation's stages in order with their counts (L2-018 AC1, L2-144 AC3).</summary>
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
            partner.Stage?.Key ?? string.Empty,
            canWrite,
            last,
            next?.NextStep,
            next?.NextStepDue,
            canWrite,
            partner.Version,
            archived,
            access.CanRestore && partner.IsArchived,
            partner.Stage is { IsArchived: true } stage ? $"{stage.Name} (archived)" : partner.Stage?.Name,
            partner.Stage?.Kind.ToString());
    }
}
