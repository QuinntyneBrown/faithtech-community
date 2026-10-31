namespace FaithTech.Community.Application.Common;

public class MarketingOptions
{
    public const string Section = "Marketing";

    /// <summary>
    /// Origin of the default organisation's public host (www.faithtech.community), used for Google sign-in outcomes.
    /// Its host serves <see cref="DefaultSite"/> unless <see cref="Sites"/> has an entry for it.
    /// </summary>
    public string Origin { get; set; } = string.Empty;

    /// <summary>The marketing content of <see cref="Origin"/>'s host, which belongs to the default organisation.</summary>
    public MarketingSite DefaultSite { get; set; } = new();

    /// <summary>Every other public host (host name, with a port if it has one) and its organisation's marketing content (L2-134 AC3).</summary>
    public Dictionary<string, MarketingSite> Sites { get; set; } = new(StringComparer.OrdinalIgnoreCase);

    /// <summary>The entry for a request's host, or null when the host is not a public host.</summary>
    public PublicSite? Find(string authority, string defaultSlug)
    {
        foreach (var (host, site) in Sites)
        {
            if (string.Equals(host, authority, StringComparison.OrdinalIgnoreCase))
            {
                return new PublicSite($"https://{host}", site.OrganisationSlug ?? string.Empty, site);
            }
        }

        return Uri.TryCreate(Origin, UriKind.Absolute, out var origin) && string.Equals(origin.Authority, authority, StringComparison.OrdinalIgnoreCase)
            ? new PublicSite(Origin.TrimEnd('/'), DefaultSite.OrganisationSlug ?? defaultSlug, DefaultSite)
            : null;
    }

    /// <summary>The origins of every public host that belongs to the organisation <paramref name="slug"/>.</summary>
    public IEnumerable<string> PublicOriginsOf(string slug, string defaultSlug)
    {
        if (!string.IsNullOrWhiteSpace(Origin) && string.Equals(DefaultSite.OrganisationSlug ?? defaultSlug, slug, StringComparison.Ordinal))
        {
            yield return Origin.TrimEnd('/');
        }

        foreach (var (host, site) in Sites)
        {
            if (string.Equals(site.OrganisationSlug, slug, StringComparison.Ordinal))
            {
                yield return $"https://{host}";
            }
        }
    }
}

/// <summary>One public host's marketing page: whose it is, and the content the one marketing build shows on it.</summary>
public class MarketingSite
{
    /// <summary>The organisation the host belongs to; for <see cref="MarketingOptions.DefaultSite"/>, the default organisation when unset.</summary>
    public string? OrganisationSlug { get; set; }

    public string? Headline { get; set; }

    /// <summary>The brochure video; the page shows no video when it is unset.</summary>
    public string? BrochureUrl { get; set; }

    public string? BrochurePosterUrl { get; set; }

    public string? BrochureCaptionsUrl { get; set; }

    /// <summary>The video's accessible name, for example "FaithTech Community in 21 seconds".</summary>
    public string? BrochureTitle { get; set; }

    /// <summary>What the poster shows, for people who cannot see it.</summary>
    public string? BrochurePosterAlt { get; set; }

    /// <summary>The footer's copyright line.</summary>
    public string? Footer { get; set; }
}

/// <summary>A public host found in <see cref="MarketingOptions"/>: its origin, its organisation and its content.</summary>
public sealed record PublicSite(string Origin, string OrganisationSlug, MarketingSite Content);
