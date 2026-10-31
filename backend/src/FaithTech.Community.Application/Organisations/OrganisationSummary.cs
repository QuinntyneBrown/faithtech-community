using FaithTech.Community.Application.Common;

namespace FaithTech.Community.Application.Organisations;

/// <summary>What an organisation calls its chapters, singular and plural (L2-140).</summary>
public record ChapterLabelDto(string Singular, string Plural)
{
    public static ChapterLabelDto? Of(ICurrentOrganisation organisation) =>
        organisation is { ChapterLabelSingular: { } singular, ChapterLabelPlural: { } plural } ? new(singular, plural) : null;
}

/// <summary>
/// Answers GET /api/site for anyone on the host, signed in or not: the names the pages that render before sign-in
/// show, and the community app's origin the marketing page hands over to (L2-133 AC1, L2-134 AC1). On a public host it
/// adds that host's marketing content from its <c>Marketing:Sites</c> entry (L2-134 AC3); elsewhere those are null.
/// </summary>
public record SiteDto(
    string Name,
    string ShortName,
    ChapterLabelDto? ChapterLabel,
    string CommunityOrigin,
    string? Headline = null,
    BrochureDto? Brochure = null,
    string? Footer = null)
{
    public static SiteDto Of(ICurrentOrganisation organisation, MarketingSite? site = null) =>
        new(
            organisation.Name,
            organisation.ShortName,
            ChapterLabelDto.Of(organisation),
            organisation.Origin,
            site?.Headline,
            BrochureDto.Of(site),
            site?.Footer);
}

/// <summary>A public host's brochure video: the file, its poster, its captions, its name and the poster's description.</summary>
public record BrochureDto(string Url, string? PosterUrl, string? CaptionsUrl, string? Title, string? PosterAlt)
{
    public static BrochureDto? Of(MarketingSite? site) =>
        site is { BrochureUrl: { Length: > 0 } url }
            ? new(url, site.BrochurePosterUrl, site.BrochureCaptionsUrl, site.BrochureTitle, site.BrochurePosterAlt)
            : null;
}

/// <summary>The organisation part of GET /api/me (L2-133 AC1).</summary>
public record MeOrganisationDto(string Slug, string Name, string ShortName, string Host, ChapterLabelDto? ChapterLabel)
{
    public static MeOrganisationDto Of(ICurrentOrganisation organisation) =>
        new(organisation.Slug, organisation.Name, organisation.ShortName, organisation.Host, ChapterLabelDto.Of(organisation));
}
