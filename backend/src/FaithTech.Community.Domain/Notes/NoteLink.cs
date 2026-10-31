using FaithTech.Community.Domain.Organisations;

namespace FaithTech.Community.Domain.Notes;

/// <summary>One page linking to another, rebuilt from the page links on every save; it drives "Linked from" (L2-090).</summary>
public class NoteLink : IOrganisationScoped
{
    /// <summary>The organisation the record belongs to, stamped when it is saved (ADR 0032).</summary>
    public Guid OrganisationId { get; private set; }

    private NoteLink() { }

    public NoteLink(Guid sourceId, Guid targetId)
    {
        SourceId = sourceId;
        TargetId = targetId;
    }

    public Guid SourceId { get; private set; }

    public Guid TargetId { get; private set; }
}
