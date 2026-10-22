namespace FaithTech.Community.Domain.Notes;

/// <summary>One page linking to another, rebuilt from the page links on every save; it drives "Linked from" (L2-090).</summary>
public class NoteLink
{
    private NoteLink() { }

    public NoteLink(Guid sourceId, Guid targetId)
    {
        SourceId = sourceId;
        TargetId = targetId;
    }

    public Guid SourceId { get; private set; }

    public Guid TargetId { get; private set; }
}
