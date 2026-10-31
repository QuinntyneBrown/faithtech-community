namespace FaithTech.Community.Domain.Organisations;

/// <summary>
/// One subdivision of an organisation under the label it chooses, such as a city or a campus (ADR 0034,
/// docs/detailed-designs/organisations/chapters). A single level; it tags and filters, never hides. Archived, never
/// deleted, so the records that reference it keep showing its name.
/// </summary>
public class Chapter : IOrganisationScoped
{
    public const int MaxNameLength = 60;

    private Chapter()
    {
        Name = string.Empty;
        NormalizedName = string.Empty;
    }

    public Chapter(string name, int sortOrder)
        : this()
    {
        Id = Guid.NewGuid();
        Rename(name);
        SortOrder = sortOrder;
    }

    public Guid Id { get; private set; }

    public Guid OrganisationId { get; private set; }

    public string Name { get; private set; }

    /// <summary>The name upper-cased, so an active name is unique ignoring case (L2-140 AC4).</summary>
    public string NormalizedName { get; private set; }

    public int SortOrder { get; private set; }

    public DateTime? ArchivedAtUtc { get; private set; }

    public bool IsArchived => ArchivedAtUtc is not null;

    public static string Normalize(string name) => name.Trim().ToUpperInvariant();

    public void Rename(string name)
    {
        var trimmed = name?.Trim() ?? string.Empty;
        if (trimmed.Length == 0 || trimmed.Length > MaxNameLength)
        {
            throw new ArgumentException($"A chapter needs a name of up to {MaxNameLength} characters.", nameof(name));
        }

        Name = trimmed;
        NormalizedName = Normalize(trimmed);
    }

    public void MoveTo(int sortOrder) => SortOrder = sortOrder;

    public void Archive(DateTime nowUtc) => ArchivedAtUtc ??= nowUtc;
}
