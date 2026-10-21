using FaithTech.Community.Domain.Profiles;

namespace FaithTech.Community.Application.Common;

public interface ICurrentUser
{
    Guid? UserId { get; }

    IReadOnlyCollection<Role> Roles { get; }

    bool IsAuthenticated { get; }

    bool HasRole(Role role);
}
