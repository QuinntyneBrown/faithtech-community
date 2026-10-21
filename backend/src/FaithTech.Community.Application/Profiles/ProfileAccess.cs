using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Profiles;

public enum EditAccess
{
    Owner,
    /// <summary>A System Admin changing someone else's profile: allowed and audited.</summary>
    AdminOverride,
    Forbidden,
}

/// <summary>Who may change a profile: its owner, or a System Admin (ADR 0004).</summary>
public class ProfileAccess(IApplicationDbContext db, ICurrentUser current)
{
    public async Task<Guid?> CallerProfileIdAsync(CancellationToken cancellationToken = default) =>
        current.UserId is { } userId
            ? await db.Users.Where(u => u.Id == userId).Select(u => (Guid?)u.ProfileId).SingleOrDefaultAsync(cancellationToken)
            : null;

    public bool CanEdit(Guid profileId, Guid? callerProfileId) =>
        profileId == callerProfileId || current.HasRole(Role.SystemAdmin);

    /// <summary>Decides how the caller may change the profile, and returns the caller's profile id as the actor.</summary>
    public async Task<(EditAccess Access, Guid Actor)> AuthorizeEditAsync(Guid profileId, CancellationToken cancellationToken = default)
    {
        var caller = await CallerProfileIdAsync(cancellationToken);
        var access = profileId == caller ? EditAccess.Owner
            : current.HasRole(Role.SystemAdmin) ? EditAccess.AdminOverride
            : EditAccess.Forbidden;
        return (access, caller ?? Guid.Empty);
    }
}
