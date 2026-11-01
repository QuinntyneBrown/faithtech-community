using System.Text.RegularExpressions;

namespace FaithTech.Community.Domain.Organisations;

/// <summary>
/// A tenant of the platform: a named community with its own host, members, roles, chapters and data (ADR 0032).
/// The request host decides which organisation is current; nothing else does.
/// </summary>
public partial class Organisation
{
    public const int MaxNameLength = 100;
    public const int MaxShortNameLength = 30;
    public const int MaxChapterLabelLength = 30;
    public const int MaxHostLength = 253;
    public const int MaxSlugLength = 40;
    public const int MaxGivingLinkLength = 500;
    public const int MaxGivingTextLength = 120;

    private Organisation()
    {
        Slug = string.Empty;
        Host = string.Empty;
    }

    public Organisation(Guid id, string slug, string host, string name, string shortName, DateTime createdAtUtc)
    {
        if (!SlugPattern().IsMatch(slug ?? string.Empty))
        {
            throw new ArgumentException("A slug is 3 to 40 lower-case letters, digits and hyphens, starting with a letter or digit.", nameof(slug));
        }

        if (string.IsNullOrWhiteSpace(host) || host.Trim().Length > MaxHostLength)
        {
            throw new ArgumentException("An organisation needs a host.", nameof(host));
        }

        Id = id;
        Slug = slug!;
        Host = host.Trim().ToLowerInvariant();
        Status = OrganisationStatus.Active;
        CreatedAtUtc = createdAtUtc;
        Rename(name, shortName);
    }

    public Guid Id { get; private set; }

    public string Slug { get; private set; }

    /// <summary>The community host, in lower case: it serves the organisation's app, API and identity server.</summary>
    public string Host { get; private set; }

    public string Name { get; private set; } = string.Empty;

    public string ShortName { get; private set; } = string.Empty;

    /// <summary>What a chapter is called, such as "City"; null when the organisation has no chapters (ADR 0034).</summary>
    public string? ChapterLabelSingular { get; private set; }

    public string? ChapterLabelPlural { get; private set; }

    /// <summary>Where event hubs send people who want to give (https), or none (L2-158 AC4, ADR 0038).</summary>
    public string? GivingLink { get; private set; }

    /// <summary>The words on the giving button, such as "Help us build the next one.", or none.</summary>
    public string? GivingText { get; private set; }

    public OrganisationStatus Status { get; private set; }

    public string? SuspendedReason { get; private set; }

    public DateTime? SuspendedAtUtc { get; private set; }

    public DateTime CreatedAtUtc { get; private set; }

    public void Rename(string name, string shortName)
    {
        Name = Required(name, MaxNameLength, nameof(name));
        ShortName = Required(shortName, MaxShortNameLength, nameof(shortName));
    }

    /// <summary>Turns chapters on with both forms of the label, or off with neither.</summary>
    /// <summary>Sets or clears the giving link and text; Application checks the link is https.</summary>
    public void SetGiving(string? link, string? text)
    {
        GivingLink = string.IsNullOrWhiteSpace(link) ? null : link.Trim();
        GivingText = string.IsNullOrWhiteSpace(text) ? null : text.Trim();
    }

    public void SetChapterLabel(string? singular, string? plural)
    {
        if (singular is null && plural is null)
        {
            ChapterLabelSingular = null;
            ChapterLabelPlural = null;
            return;
        }

        ChapterLabelSingular = Required(singular, MaxChapterLabelLength, nameof(singular));
        ChapterLabelPlural = Required(plural, MaxChapterLabelLength, nameof(plural));
    }

    /// <summary>
    /// A new organisation held as Provisioning while its defaults are written, so no request resolves it until
    /// <see cref="CompleteProvisioning"/> makes it Active (L2-149 AC1).
    /// </summary>
    public static Organisation ForProvisioning(Guid id, string slug, string host, string name, string shortName, DateTime createdAtUtc)
    {
        var organisation = new Organisation(id, slug, host, name, shortName, createdAtUtc) { Status = OrganisationStatus.Provisioning };
        return organisation;
    }

    public void CompleteProvisioning()
    {
        if (Status != OrganisationStatus.Provisioning)
        {
            throw new InvalidOperationException("The organisation is not being provisioned.");
        }

        Status = OrganisationStatus.Active;
    }

    public void Suspend(string reason, DateTime nowUtc)
    {
        if (Status == OrganisationStatus.Suspended)
        {
            throw new InvalidOperationException("The organisation is already suspended.");
        }

        SuspendedReason = Required(reason, 500, nameof(reason));
        Status = OrganisationStatus.Suspended;
        SuspendedAtUtc = nowUtc;
    }

    public void Lift()
    {
        if (Status != OrganisationStatus.Suspended)
        {
            throw new InvalidOperationException("The organisation is not suspended.");
        }

        Status = OrganisationStatus.Active;
        SuspendedReason = null;
        SuspendedAtUtc = null;
    }

    private static string Required(string? value, int maxLength, string name)
    {
        var trimmed = value?.Trim();
        if (string.IsNullOrEmpty(trimmed))
        {
            throw new ArgumentException("A value is required.", name);
        }

        if (trimmed.Length > maxLength)
        {
            throw new ArgumentException($"At most {maxLength} characters.", name);
        }

        return trimmed;
    }

    [GeneratedRegex("^[a-z0-9][a-z0-9-]{2,39}$")]
    private static partial Regex SlugPattern();
}
