using Microsoft.AspNetCore.Identity;

namespace FaithTech.Community.Application.Identity;

public class CommunityUser : IdentityUser<Guid>
{
    public Guid ProfileId { get; set; }
}
