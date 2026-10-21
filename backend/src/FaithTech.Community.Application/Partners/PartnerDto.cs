using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Partners;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Partners;

/// <summary>One stage move in a partner's history (L2-018 AC2).</summary>
public record PartnerStageChangeDto(string From, string To, Guid MovedById, string MovedByName, DateTime MovedAtUtc, string? Note);

/// <summary>A partner record. Stage is Lead, InFunnel or Confirmed; History is newest first.</summary>
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
    IReadOnlyList<PartnerStageChangeDto> History,
    bool CanEdit);

public record PartnerCardDto(Guid Id, string Name, string? ContactName, string? Offering);

public record PartnerColumnDto(string Stage, int Count, IReadOnlyList<PartnerCardDto> Cards);

/// <summary>The board: the three stages in order with their counts (L2-018 AC1).</summary>
public record PartnerBoardDto(IReadOnlyList<PartnerColumnDto> Columns, bool CanEdit);

public record PartnerOwnerDto(Guid ProfileId, string Name);

public class PartnerViews(IApplicationDbContext db, PartnerAccess access)
{
    public async Task<PartnerDto> ToDtoAsync(Partner partner, CancellationToken cancellationToken = default)
    {
        var people = partner.StageChanges.Select(c => c.MovedBy).Append(partner.OwnerId ?? Guid.Empty).Distinct().ToList();
        var names = await db.Profiles.AsNoTracking().Where(p => people.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id, p => p.Name, cancellationToken);
        var history = partner.StageChanges
            .OrderByDescending(c => c.MovedAtUtc)
            .Select(c => new PartnerStageChangeDto(
                c.From.ToString(), c.To.ToString(), c.MovedBy, names.GetValueOrDefault(c.MovedBy, "A former member"), c.MovedAtUtc, c.Note))
            .ToList();
        return new PartnerDto(
            partner.Id,
            partner.Name,
            partner.Website,
            partner.Offering,
            partner.OwnerId,
            partner.OwnerId is { } owner ? names.GetValueOrDefault(owner) : null,
            partner.ContactName,
            partner.Email,
            partner.Phone,
            partner.Notes,
            partner.Stage.ToString(),
            history,
            access.CanWrite);
    }
}
