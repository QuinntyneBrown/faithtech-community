using FaithTech.Community.Domain.Organisations;

namespace FaithTech.Community.Domain.Profiles;

/// <summary>
/// A role a profile holds: a reference to one of the organisation's role definitions (ADR 0033), tagged with a chapter
/// when the definition is chapter-scopable (L2-141 AC3). A profile holds a definition once per tag, and once untagged.
/// </summary>
public class ProfileRole
{
    private ProfileRole() { }

    internal ProfileRole(Guid profileId, Guid roleDefinitionId, Guid? chapterId, Guid grantedBy, DateTime grantedAtUtc)
    {
        Id = Guid.NewGuid();
        ProfileId = profileId;
        ChapterId = chapterId;
        RoleDefinitionId = roleDefinitionId;
        GrantedBy = grantedBy;
        GrantedAtUtc = grantedAtUtc;
    }

    public Guid Id { get; private set; }

    public Guid ProfileId { get; private set; }

    /// <summary>The chapter the role is held for, or null when it is held organisation-wide.</summary>
    public Guid? ChapterId { get; private set; }

    public Guid RoleDefinitionId { get; private set; }

    /// <summary>The definition, loaded with the profile.</summary>
    public RoleDefinition? Definition { get; internal set; }

    public DateTime GrantedAtUtc { get; private set; }

    public Guid GrantedBy { get; private set; }
}
