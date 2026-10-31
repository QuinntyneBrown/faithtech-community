namespace FaithTech.Community.Application.Organisations;

/// <summary>What an organisation calls its chapters, singular and plural (L2-140).</summary>
public record ChapterLabelDto(string Singular, string Plural)
{
    public static ChapterLabelDto? Of(ICurrentOrganisation organisation) =>
        organisation is { ChapterLabelSingular: { } singular, ChapterLabelPlural: { } plural } ? new(singular, plural) : null;
}

/// <summary>
/// Answers GET /api/site for anyone on the host, signed in or not: the names the pages that render before sign-in
/// show, and the community app's origin the marketing page hands over to (L2-133 AC1, L2-134 AC1).
/// </summary>
public record SiteDto(string Name, string ShortName, ChapterLabelDto? ChapterLabel, string CommunityOrigin)
{
    public static SiteDto Of(ICurrentOrganisation organisation) =>
        new(organisation.Name, organisation.ShortName, ChapterLabelDto.Of(organisation), organisation.Origin);
}

/// <summary>The organisation part of GET /api/me (L2-133 AC1).</summary>
public record MeOrganisationDto(string Slug, string Name, string ShortName, string Host, ChapterLabelDto? ChapterLabel)
{
    public static MeOrganisationDto Of(ICurrentOrganisation organisation) =>
        new(organisation.Slug, organisation.Name, organisation.ShortName, organisation.Host, ChapterLabelDto.Of(organisation));
}
