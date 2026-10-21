using Microsoft.AspNetCore.Identity;

namespace FaithTech.Community.Application.Identity;

public class CommunityUser : IdentityUser<Guid>
{
    public Guid ProfileId { get; set; }

    /// <summary>When the first failed sign-in counted in <see cref="IdentityUser{TKey}.AccessFailedCount"/> happened.</summary>
    public DateTimeOffset? FailedAccessWindowStartedAt { get; set; }
}
