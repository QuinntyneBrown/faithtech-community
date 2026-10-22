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

    public NoteShareRole(Guid pageId, Profiles.Role role)
    {
        PageId = pageId;
        Role = role;
    }

    public Guid PageId { get; private set; }

    public Profiles.Role Role { get; private set; }
}
