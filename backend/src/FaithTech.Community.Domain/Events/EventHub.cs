using FaithTech.Community.Domain.Organisations;

namespace FaithTech.Community.Domain.Events;

/// <summary>
/// An event's optional participant hub (L2-153, ADR 0036): one per event, a Draft until it is published, made of sections.
/// It stores none of the event's facts (title, dates, venue, RSVP link); they are read from the event on every request.
/// </summary>
public class EventHub : IOrganisationScoped
{
    /// <summary>The only starting point until templates arrive (slice 45).</summary>
    public const string BlankTemplate = "blank";

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

    /// <summary>The starting point the hub was made from; <see cref="BlankTemplate"/> until templates arrive.</summary>
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
    /// Saves the wizard's answers (L2-153 AC5, AC7): the starting point, and the visibility of each section named; a kind left
    /// out keeps its visibility.
    /// </summary>
    public void Save(string templateKey, IReadOnlyDictionary<HubSectionKind, bool> visibility, DateTimeOffset now)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(templateKey);
        TemplateKey = templateKey;
        foreach (var section in _sections)
        {
            if (visibility.TryGetValue(section.Kind, out var visible))
            {
                section.Show(visible);
            }
        }

        UpdatedAt = now;
    }

    /// <summary>Replaces one section's content (L2-157 AC2); the JSON is validated by Application before it gets here.</summary>
    public void FillSection(HubSectionKind kind, string content, DateTimeOffset now)
    {
        _sections.Single(s => s.Kind == kind).Fill(content);
        UpdatedAt = now;
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
