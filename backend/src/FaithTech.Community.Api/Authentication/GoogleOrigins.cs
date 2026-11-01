using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Organisations;
using Microsoft.Extensions.Options;

namespace FaithTech.Community.Api.Authentication;

/// <summary>
/// Where Google sign-in calls back and where it sends the visitor afterwards, for the organisation of the request's
/// host (L2-078): its community origin, and its public page for a failure. The default organisation keeps
/// <c>WebApp:Origin</c> and <c>Marketing:Origin</c>, so FaithTech's flow is unchanged.
/// </summary>
public class GoogleOrigins(
    ICurrentOrganisation organisation,
    IOptions<PlatformOptions> platform,
    IOptions<WebAppOptions> webApp,
    IOptions<MarketingOptions> marketing)
{
    private bool IsDefault => organisation.Slug == platform.Value.DefaultOrganisationSlug;

    /// <summary>The organisation's community origin, which serves the API and the community app.</summary>
    public string Community => IsDefault ? webApp.Value.Origin.TrimEnd('/') : organisation.Origin;

    public string Callback => $"{Community}/api/account/google/callback";

    /// <summary>Back to the public page the button is on, or the community sign-in when the organisation has none.</summary>
    public string Outcome(string outcome)
    {
        if (IsDefault)
        {
            return $"{marketing.Value.Origin}/?google={outcome}";
        }

        var site = marketing.Value.PublicOriginsOf(organisation.Slug, platform.Value.DefaultOrganisationSlug).FirstOrDefault();
        return site is null ? $"{Community}/sign-in" : $"{site}/?google={outcome}";
    }
}
