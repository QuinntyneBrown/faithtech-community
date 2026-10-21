using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Profiles;

/// <summary>Who may change a profile: its owner, or a System Admin (ADR 0004).</summary>
public class ProfileAccess(IApplicationDbContext db, ICurrentUser current)
{
    public async Task<Guid?> CallerProfileIdAsync(CancellationToken cancellationToken = default) =>
        current.UserId is { } userId
            ? await db.Users.Where(u => u.Id == userId).Select(u => (Guid?)u.ProfileId).SingleOrDefaultAsync(cancellationToken)
            : null;

    public bool CanEdit(Guid profileId, Guid? callerProfileId) =>
        profileId == callerProfileId || current.HasRole(Role.SystemAdmin);
}
