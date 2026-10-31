using FaithTech.Community.Domain.Organisations;
using FaithTech.Community.Domain.Profiles;

namespace FaithTech.Community.Application.Tests;

/// <summary>
/// Domain tests arrange roles by the former <see cref="Role"/> values, each a definition whose key is the value; City Lead
/// carries OwnWorkspaces as in FaithTech's seed.
/// </summary>
public static class TestRoles
{
    private static readonly Dictionary<Role, RoleDefinition> Definitions = Enum.GetValues<Role>().ToDictionary(
        role => role,
        role => new RoleDefinition(
            Guid.NewGuid(), role.ToString(), role.ToString(), string.Empty,
            role == Role.CityLead ? [Capability.OwnWorkspaces] : [], (int)role));

    public static RoleDefinition Definition(Role role) => Definitions[role];

    extension(Profile profile)
    {
        public void AddRole(Role role, Guid grantedBy, DateTime nowUtc) => profile.AddRole(Definition(role), grantedBy, nowUtc);

        public void RemoveRole(Role role) => profile.RemoveRole(Definition(role).Id);
    }

    extension(ProfileRole held)
    {
        public Role Role => Enum.Parse<Role>(held.Definition!.Key);
    }
}
