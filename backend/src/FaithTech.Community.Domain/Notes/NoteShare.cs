namespace FaithTech.Community.Domain.Notes;

/// <summary>A member named in a Shared page's audience.</summary>
public class NoteShareMember
{
    private NoteShareMember() { }

    public NoteShareMember(Guid pageId, Guid profileId)
    {
        PageId = pageId;
        ProfileId = profileId;
    }

    public Guid PageId { get; private set; }

    public Guid ProfileId { get; private set; }
}

/// <summary>A role named in a Shared page's audience. Whoever holds it at request time may open the page (ADR 0025).</summary>
public class NoteShareRole
{
    private NoteShareRole() { }

    public NoteShareRole(Guid pageId, Organisations.RoleDefinition definition)
    {
        PageId = pageId;
        RoleDefinitionId = definition.Id;
        Definition = definition;
    }

    public Guid PageId { get; private set; }

    /// <summary>The organisation's role definition named in the audience (ADR 0033).</summary>
    public Guid RoleDefinitionId { get; private set; }

    /// <summary>The definition, loaded with the page.</summary>
    public Organisations.RoleDefinition? Definition { get; private set; }
}
