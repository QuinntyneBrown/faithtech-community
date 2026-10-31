namespace FaithTech.Community.Domain.Resources;

/// <summary>A visibility with, for Shared, the named members and roles (at least one of either).</summary>
public record ResourceAudience
{
    private ResourceAudience(ResourceVisibility visibility, IReadOnlySet<Guid> members, IReadOnlyList<Organisations.RoleDefinition> roles)
    {
        Visibility = visibility;
        Members = members;
        Roles = roles;
    }

    public ResourceVisibility Visibility { get; }

    public IReadOnlySet<Guid> Members { get; }

    /// <summary>The role definitions named.</summary>
    public IReadOnlyList<Organisations.RoleDefinition> Roles { get; }

    public IReadOnlySet<Guid> RoleIds => Roles.Select(r => r.Id).ToHashSet();

    public static ResourceAudience Private() => new(ResourceVisibility.Private, new HashSet<Guid>(), []);

    public static ResourceAudience Global() => new(ResourceVisibility.Global, new HashSet<Guid>(), []);

    public static ResourceAudience Shared(IEnumerable<Guid> members, IEnumerable<Organisations.RoleDefinition> roles)
    {
        var memberSet = members.ToHashSet();
        var roleSet = roles.DistinctBy(r => r.Id).ToList();
        if (memberSet.Count == 0 && roleSet.Count == 0)
        {
            throw new ArgumentException("A shared resource needs at least one member or role.");
        }

        return new(ResourceVisibility.Shared, memberSet, roleSet);
    }
}
