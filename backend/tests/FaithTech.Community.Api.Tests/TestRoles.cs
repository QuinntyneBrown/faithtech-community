using FaithTech.Community.Domain.Organisations;
using FaithTech.Community.Domain.Profiles;
using FaithTech.Community.Infrastructure.Persistence.Seed;

namespace FaithTech.Community.Api.Tests;

/// <summary>
/// Arranges and reads roles by the former <see cref="Role"/> values: each is FaithTech's seeded definition with the same key
/// (L2-151 AC4). Another organisation gets its own copy of the definitions (<see cref="DefinitionsFor"/>).
/// </summary>
public static class TestRoles
{
    public static Guid DefinitionId(Role role) => FaithTechSeed.Roles.Single(r => r.Key == role.ToString()).Id;

    /// <summary>A copy of FaithTech's role definitions, with new ids, for another organisation in a test.</summary>
    public static IReadOnlyList<RoleDefinition> DefinitionsFor()
    {
        var ids = FaithTechSeed.Roles.ToDictionary(r => r.Key, _ => Guid.NewGuid());
        return
        [
            .. FaithTechSeed.Roles.Select((role, index) =>
            {
                var definition = new RoleDefinition(ids[role.Key], role.Key, role.Name, role.Description, role.Capabilities, index);
                definition.SetFlags(role.ShowOnTeam, role.ChapterScopable, role.IsOversight);
                definition.SetGrantableRoles(role.Grants.Select(key => ids[key]));
                return definition;
            }),
        ];
    }

    extension(Profile profile)
    {
        /// <summary>Grants FaithTech's definition of <paramref name="role"/>.</summary>
        public void AddRole(Role role, Guid grantedBy, DateTime nowUtc) => profile.AddRole(DefinitionId(role), grantedBy, nowUtc);

        public bool HasRole(Role role) => profile.HasRole(DefinitionId(role));

        public void RemoveRole(Role role) => profile.RemoveRole(profile.Roles.Single(r => r.Role == role).RoleDefinitionId);
    }

    extension(ProfileRole held)
    {
        /// <summary>The former role value the held definition's key names.</summary>
        public Role Role => Enum.Parse<Role>(held.Definition?.Key ?? FaithTechSeed.Roles.Single(r => r.Id == held.RoleDefinitionId).Key);
    }
}
