using FaithTech.Community.Domain.Organisations;

namespace FaithTech.Community.Domain.Events;

/// <summary>
/// An event's optional participant hub (L2-153, ADR 0036): one per event, a Draft until it is published, made of sections.
/// It stores none of the event's facts (title, dates, venue, RSVP link); they are read from the event on every request.
/// </summary>
public class EventHub : IOrganisationScoped
{
    /// <summary>The empty starting point (L2-169 AC3).</summary>
    public const string BlankTemplate = "blank";

    /// <summary>The starting point of a hub copied from another (L2-170 AC4).</summary>
    public const string CopyTemplate = "copy";

    private readonly List<HubSection> _sections = [];

    private EventHub() { }

    private EventHub(Guid eventId, DateTimeOffset now)
    {
        Id = Guid.NewGuid();
        EventId = eventId;
        Status = EventHubStatus.Draft;
        TemplateKey = BlankTemplate;
        CreatedAt = now;
        UpdatedAt = now;
    }

    /// <summary>The organisation the record belongs to, stamped when it is saved (ADR 0032).</summary>
    public Guid OrganisationId { get; private set; }

    public Guid Id { get; private set; }

    public Guid EventId { get; private set; }

    public EventHubStatus Status { get; private set; }

    /// <summary>The starting point the hub was made from: a template's id, <see cref="BlankTemplate"/> or <see cref="CopyTemplate"/>.</summary>
    public string TemplateKey { get; private set; } = BlankTemplate;

    /// <summary>The day-of update banner (slice 48); none until then.</summary>
    public string? UpdateBanner { get; private set; }

    public DateTimeOffset? PublishedAt { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset UpdatedAt { get; private set; }

    /// <summary>The sections; <see cref="HubSection.Order"/> gives their place.</summary>
    public IReadOnlyCollection<HubSection> Sections => _sections;

    /// <summary>A Draft hub starting from Blank, with one shown, empty section of every kind in catalogue order (L2-153 AC3).</summary>
    public static EventHub CreateBlank(Guid eventId, DateTimeOffset now)
    {
        var hub = new EventHub(eventId, now);
        var order = 0;
        foreach (var kind in Enum.GetValues<HubSectionKind>())
        {
            hub._sections.Add(new HubSection(hub.Id, kind, order++));
        }

        return hub;
    }

    /// <summary>
    /// Saves the wizard's answers (L2-153 AC5, AC7): the starting point when given, and the visibility of each section
    /// named; a kind left out keeps its visibility.
    /// </summary>
    public void Save(string? templateKey, IReadOnlyDictionary<HubSectionKind, bool> visibility, DateTimeOffset now)
    {
        if (!string.IsNullOrWhiteSpace(templateKey))
        {
            TemplateKey = templateKey;
        }

        foreach (var section in _sections)
        {
            if (visibility.TryGetValue(section.Kind, out var visible))
            {
                section.Show(visible);
            }
        }

        UpdatedAt = now;
    }

    /// <summary>
    /// Applies a starting point (L2-169 AC3, L2-170 AC4, ADR 0041): one entry per kind, in the order wanted, sets each section's
    /// place, visibility and content, replacing whatever was there. The hub stays as it is otherwise.
    /// </summary>
    public void Start(string templateKey, IReadOnlyList<HubSectionStart> sections, DateTimeOffset now)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(templateKey);
        if (sections.Count != _sections.Count || sections.Select(s => s.Kind).Distinct().Count() != sections.Count
            || _sections.Any(s => sections.All(start => start.Kind != s.Kind)))
        {
            throw new ArgumentException("Name every section kind exactly once.", nameof(sections));
        }

        TemplateKey = templateKey;
        for (var order = 0; order < sections.Count; order++)
        {
            var start = sections[order];
            var section = _sections.Single(s => s.Kind == start.Kind);
            section.MoveTo(order);
            section.Show(start.Visible);
            section.Fill(start.Content ?? HubSection.EmptyContent);
        }

        UpdatedAt = now;
    }

    /// <summary>Replaces one section's content (L2-157 AC2); the JSON is validated by Application before it gets here.</summary>
    public void FillSection(HubSectionKind kind, string content, DateTimeOffset now)
    {
        _sections.Single(s => s.Kind == kind).Fill(content);
        UpdatedAt = now;
    }

    /// <summary>
    /// Publishes the hub (L2-164 AC1, ADR 0039): refuses nothing, because empty sections are left out of the page; publishing
    /// a published hub refreshes the time.
    /// </summary>
    public void Publish(DateTimeOffset now)
    {
        Status = EventHubStatus.Published;
        PublishedAt = now;
        UpdatedAt = now;
    }

    /// <summary>Returns the hub to Draft and keeps its sections (L2-164 AC3); false when it was already a draft.</summary>
    public bool Unpublish(DateTimeOffset now)
    {
        if (Status == EventHubStatus.Draft)
        {
            return false;
        }

        Status = EventHubStatus.Draft;
        PublishedAt = null;
        UpdatedAt = now;
        return true;
    }

    /// <summary>Puts the sections in the given order (L2-156 AC4); it must name every kind exactly once.</summary>
    public void Reorder(IReadOnlyList<HubSectionKind> kinds, DateTimeOffset now)
    {
        if (kinds.Count != _sections.Count || kinds.Distinct().Count() != kinds.Count || _sections.Any(s => !kinds.Contains(s.Kind)))
        {
            throw new ArgumentException("Name every section kind exactly once.", nameof(kinds));
        }

        foreach (var section in _sections)
        {
            section.MoveTo(kinds.ToList().IndexOf(section.Kind));
        }

        UpdatedAt = now;
    }
}
