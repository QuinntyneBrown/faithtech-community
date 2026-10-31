namespace FaithTech.Community.Application.Organisations;

public class PlatformOptions
{
    public const string Section = "Platform";

    /// <summary>
    /// The organisation that loopback hosts resolve to in Development (L2-131 AC4), and the one the marketing host of
    /// <c>Marketing:Origin</c> belongs to until marketing sites are configured per host.
    /// </summary>
    public string DefaultOrganisationSlug { get; set; } = "faithtech";

    /// <summary>
    /// Set only in Development: the origin that stands in for the default organisation's <c>https://{Host}</c>, so
    /// email links and the community origin keep working on localhost.
    /// </summary>
    public string? DefaultOrganisationOrigin { get; set; }
}
