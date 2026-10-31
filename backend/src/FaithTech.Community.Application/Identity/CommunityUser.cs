using Microsoft.AspNetCore.Identity;

namespace FaithTech.Community.Application.Identity;

/// <summary>A global account (ADR 0032); its memberships are the profiles whose <c>UserId</c> is its id.</summary>
public class CommunityUser : IdentityUser<Guid>
{
    /// <summary>When the first failed sign-in counted in <see cref="IdentityUser{TKey}.AccessFailedCount"/> happened.</summary>
    public DateTimeOffset? FailedAccessWindowStartedAt { get; set; }

    /// <summary>Locked by a platform operator: refused on every host until unlocked (L2-148 AC5, L2-132 AC6).</summary>
    public bool IsLocked { get; private set; }

    public string? LockedReason { get; private set; }

    public DateTime? LockedAtUtc { get; private set; }

    public void Lock(string reason, DateTime nowUtc) => (IsLocked, LockedReason, LockedAtUtc) = (true, reason, nowUtc);

    public void Unlock() => (IsLocked, LockedReason, LockedAtUtc) = (false, null, null);
}
