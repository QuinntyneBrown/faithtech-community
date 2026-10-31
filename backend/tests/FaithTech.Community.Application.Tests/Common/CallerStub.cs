using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Organisations;
using FaithTech.Community.Domain.Profiles;

namespace FaithTech.Community.Application.Tests.Common;

/// <summary>A signed-in member holding exactly the given capabilities.</summary>
public sealed class CallerStub(params string[] capabilities) : ICurrentUser
{
    public Guid? UserId { get; } = Guid.NewGuid();

    public CurrentMembership? Membership { get; } = new(Guid.NewGuid(), [], capabilities.ToHashSet(StringComparer.Ordinal));

    public IReadOnlyCollection<Role> Roles => [];

    public bool IsAuthenticated => true;

    public bool HasRole(Role role) => false;
}
