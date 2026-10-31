using Microsoft.AspNetCore.Identity;

namespace FaithTech.Community.Application.Identity;

/// <summary>A global account (ADR 0032); its memberships are the profiles whose <c>UserId</c> is its id.</summary>
public class CommunityUser : IdentityUser<Guid>
{
    /// <summary>When the first failed sign-in counted in <see cref="IdentityUser{TKey}.AccessFailedCount"/> happened.</summary>
    public DateTimeOffset? FailedAccessWindowStartedAt { get; set; }
}
