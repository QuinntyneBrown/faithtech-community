using FaithTech.Community.Domain.Profiles;

namespace FaithTech.Community.Domain.Resources;

/// <summary>A visibility with, for Shared, the named members and roles (at least one of either).</summary>
public record ResourceAudience
{
    private ResourceAudience(ResourceVisibility visibility, IReadOnlySet<Guid> members, IReadOnlySet<Role> roles)
    {
        Visibility = visibility;
        Members = members;
        Roles = roles;
    }

    public ResourceVisibility Visibility { get; }

    public IReadOnlySet<Guid> Members { get; }

    public IReadOnlySet<Role> Roles { get; }

    public static ResourceAudience Private() => new(ResourceVisibility.Private, new HashSet<Guid>(), new HashSet<Role>());

    public static ResourceAudience Global() => new(ResourceVisibility.Global, new HashSet<Guid>(), new HashSet<Role>());

    public static ResourceAudience Shared(IEnumerable<Guid> members, IEnumerable<Role> roles)
    {
        var memberSet = members.ToHashSet();
        var roleSet = roles.ToHashSet();
        if (memberSet.Count == 0 && roleSet.Count == 0)
        {
            throw new ArgumentException("A shared resource needs at least one member or role.");
        }

        return new(ResourceVisibility.Shared, memberSet, roleSet);
    }
}
