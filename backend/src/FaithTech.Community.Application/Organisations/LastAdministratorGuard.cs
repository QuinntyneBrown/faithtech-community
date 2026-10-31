using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Organisations;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Organisations;

/// <summary>
/// Keeps at least one active, unsuspended administrator in the organisation (L2-139 AC1, AC2). A change that could
/// leave none first takes the organisation's roster lease in a save of its own, so no overlapping change can count the
/// administrators until this one has saved; then it asks whether the change would leave none, and releases the lease in
/// the save that makes (or abandons) the change. Role removal and suspension call it; definition edit and archive will.
/// </summary>
public class LastAdministratorGuard(IApplicationDbContext db, TimeProvider time)
{
    public const string LastAdministratorMessage = "There must always be at least one administrator.";

    public const string ConcurrentChangeMessage = "Someone else changed administrator roles at the same time. Reload and try again.";

    private OrganisationAdminRoster? _roster;

    /// <summary>Takes the lease in a save of its own; false when another change holds it or took it first.</summary>
    public async Task<bool> TakeLeaseAsync(CancellationToken cancellationToken = default)
    {
        // An organisation provisioned without a roster gets it on its first guarded change.
        var roster = await db.OrganisationAdminRosters.SingleOrDefaultAsync(cancellationToken);
        if (roster is null)
        {
            db.OrganisationAdminRosters.Add(roster = new OrganisationAdminRoster());
        }

        if (!roster.TryTake(Guid.NewGuid(), time.GetUtcNow()))
        {
            return false;
        }

        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            // Another change took the lease between our read and our save.
            return false;
        }

        _roster = roster;
        return true;
    }

    /// <summary>
    /// Whether no active, unsuspended profile would still hold a non-archived definition carrying
    /// <c>AdministerOrganisation</c>, once <paramref name="excludingProfile"/> loses <paramref name="excludingDefinition"/>
    /// (a role removal), <paramref name="excludingProfile"/> stops counting (a suspension), or
    /// <paramref name="excludingDefinition"/> stops carrying it for everyone (a definition edit or archive).
    /// </summary>
    public async Task<bool> WouldLeaveNoneAsync(
        Guid? excludingProfile = null, Guid? excludingDefinition = null, CancellationToken cancellationToken = default)
    {
        var wholeProfile = excludingDefinition is null ? excludingProfile : null;
        var remaining = await db.Profiles
            .Where(p => !p.IsSuspended && p.Id != wholeProfile)
            .CountAsync(p => p.Roles.Any(r =>
                r.Definition!.ArchivedAtUtc == null
                && r.Definition.Capabilities.Contains(Capability.AdministerOrganisation)
                && !(r.RoleDefinitionId == excludingDefinition && (excludingProfile == null || p.Id == excludingProfile))),
                cancellationToken);
        return remaining == 0;
    }

    /// <summary>Releases the lease; the caller's next save carries it with the change.</summary>
    public void Release() => _roster?.Release();
}
