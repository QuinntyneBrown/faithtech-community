using FaithTech.Community.Domain.Organisations;

namespace FaithTech.Community.Domain.Profiles;

/// <summary>A role a profile holds: a reference to one of the organisation's role definitions (ADR 0033).</summary>
public class ProfileRole
{
    private ProfileRole() { }

    internal ProfileRole(Guid profileId, Guid roleDefinitionId, Guid grantedBy, DateTime grantedAtUtc)
    {
        ProfileId = profileId;
        RoleDefinitionId = roleDefinitionId;
        GrantedBy = grantedBy;
        GrantedAtUtc = grantedAtUtc;
    }

    public Guid ProfileId { get; private set; }

    public Guid RoleDefinitionId { get; private set; }

    /// <summary>The definition, loaded with the profile.</summary>
    public RoleDefinition? Definition { get; internal set; }

    public DateTime GrantedAtUtc { get; private set; }

    public Guid GrantedBy { get; private set; }
}
