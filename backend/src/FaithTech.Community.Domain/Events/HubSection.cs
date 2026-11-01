using FaithTech.Community.Domain.Organisations;

namespace FaithTech.Community.Domain.Events;

/// <summary>
/// One part of an event hub: a kind, its place, whether it is shown and its content as JSON, filled by the section's wizard
/// and validated against the kind's schema in Application (ADR 0036). An empty section is <c>{}</c>.
/// </summary>
public class HubSection : IOrganisationScoped
{
    public const string EmptyContent = "{}";

    private HubSection() { }

    internal HubSection(Guid eventHubId, HubSectionKind kind, int order)
    {
        Id = Guid.NewGuid();
        EventHubId = eventHubId;
        Kind = kind;
        Order = order;
        Visible = true;
    }

    /// <summary>The organisation the record belongs to, stamped when it is saved (ADR 0032).</summary>
    public Guid OrganisationId { get; private set; }

    public Guid Id { get; private set; }

    public Guid EventHubId { get; private set; }

    public HubSectionKind Kind { get; private set; }

    public int Order { get; private set; }

    public bool Visible { get; private set; }

    public string Content { get; private set; } = EmptyContent;

    internal void Show(bool visible) => Visible = visible;
}
