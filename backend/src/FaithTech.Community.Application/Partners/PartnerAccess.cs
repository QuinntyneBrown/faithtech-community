using FaithTech.Community.Application.Admin;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Partners;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Partners;

/// <summary>
/// The shared partner pipeline (L2-017, ADR 0014): lead roles, Staff and System Admin read it; lead
/// roles and System Admin change it. Everyone else gets 403.
/// </summary>
public class PartnerAccess(IApplicationDbContext db, ICurrentUser current, IAuditLog audit)
{
    public bool CanRead => CanWrite || current.HasRole(Role.Staff);

    public bool CanWrite => current.HoldsLeadRole() || current.HasRole(Role.SystemAdmin);

    /// <summary>Only a System Admin restores a merged partner (L2-090 AC5).</summary>
    public bool CanRestore => current.HasRole(Role.SystemAdmin);

    public async Task<Guid> CallerProfileIdAsync(CancellationToken cancellationToken = default) =>
        current.UserId is { } userId
            ? await db.Users.Where(u => u.Id == userId).Select(u => u.ProfileId).SingleOrDefaultAsync(cancellationToken)
            : Guid.Empty;

    /// <summary>A System Admin acting without a lead role changes the pipeline by admin right, so it is audited.</summary>
    public void AuditAdminWrite(Guid actor, Partner partner, string action, object? before, object? after)
    {
        if (current.HasRole(Role.SystemAdmin) && !current.HoldsLeadRole())
        {
            audit.Record(actor, action, "Partner", partner.Id.ToString(), before, after);
        }
    }

    /// <summary>Merge and restore are audited whoever performs them (L2-090 AC3, AC4).</summary>
    public void Audit(Guid actor, Partner partner, string action, object? before, object? after) =>
        audit.Record(actor, action, "Partner", partner.Id.ToString(), before, after);

    /// <summary>The 409 for a write to an archived partner (ADR 0024).</summary>
    public async Task<Result> ArchivedConflictAsync(Partner partner, string instruction, CancellationToken cancellationToken = default)
    {
        var kept = await db.Partners.AsNoTracking().Where(p => p.Id == partner.MergedIntoId).Select(p => p.Name).SingleOrDefaultAsync(cancellationToken);
        return Result.Conflict($"{partner.Name} was merged into {kept ?? "another partner"}. {instruction}");
    }
}
