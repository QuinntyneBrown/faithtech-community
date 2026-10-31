namespace FaithTech.Community.Domain.Resources;

public class ResourceTag
{
    private ResourceTag() { }

    public ResourceTag(Guid resourceId, string tag)
    {
        ResourceId = resourceId;
        Tag = tag;
    }

    public Guid ResourceId { get; private set; }

    public string Tag { get; private set; } = string.Empty;
}

/// <summary>A member named in a Shared resource's audience.</summary>
public class ResourceShareMember
{
    private ResourceShareMember() { }

    public ResourceShareMember(Guid resourceId, Guid profileId)
    {
        ResourceId = resourceId;
        ProfileId = profileId;
    }

    public Guid ResourceId { get; private set; }

    public Guid ProfileId { get; private set; }
}

/// <summary>A role named in a Shared resource's audience. Whoever holds it at request time may open the resource (ADR 0017).</summary>
public class ResourceShareRole
{
    private ResourceShareRole() { }

    public ResourceShareRole(Guid resourceId, Organisations.RoleDefinition definition)
    {
        ResourceId = resourceId;
        RoleDefinitionId = definition.Id;
        Definition = definition;
    }

    public Guid ResourceId { get; private set; }

    /// <summary>The organisation's role definition named in the audience (ADR 0033).</summary>
    public Guid RoleDefinitionId { get; private set; }

    /// <summary>The definition, loaded with the resource.</summary>
    public Organisations.RoleDefinition? Definition { get; private set; }
}
