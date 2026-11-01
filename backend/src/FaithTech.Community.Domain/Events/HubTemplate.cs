using FaithTech.Community.Domain.Organisations;

namespace FaithTech.Community.Domain.Events;

/// <summary>
/// A starting point for a hub (L2-171, ADR 0041): organisation data with a name, a one-line description, its place in the
/// list and its sections as one JSON array of <c>{ kind, visible, content }</c>. Content takes the kind's own shape, except
/// that an Agenda row holds <c>minutes</c> from the event's start instead of a time. Code never names a template.
/// </summary>
public class HubTemplate : IOrganisationScoped
{
    public const int NameMaxLength = 60;

    public const int DescriptionMaxLength = 120;

    private HubTemplate() { }

    public HubTemplate(Guid id, string name, string description, int sortOrder, string sections)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(sections);
        Id = id;
        SortOrder = sortOrder;
        Sections = sections;
        Describe(name, description);
    }

    /// <summary>The organisation the record belongs to, stamped when it is saved (ADR 0032).</summary>
    public Guid OrganisationId { get; private set; }

    public Guid Id { get; private set; }

    public string Name { get; private set; } = string.Empty;

    public string Description { get; private set; } = string.Empty;

    public int SortOrder { get; private set; }

    /// <summary>The sections as JSON: <c>[{ "kind": "Hero", "visible": true, "content": { ... } }, ...]</c>.</summary>
    public string Sections { get; private set; } = "[]";

    /// <summary>Renames the template and changes its line.</summary>
    public void Describe(string name, string description)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(name);
        Name = name.Trim();
        Description = description?.Trim() ?? string.Empty;
    }
}
