using FaithTech.Community.Api.Middleware.Organisations;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Organisations;

namespace FaithTech.Community.Api.Endpoints;

public static class SiteEndpoints
{
    public static IEndpointRouteBuilder MapSiteEndpoints(this IEndpointRouteBuilder app)
    {
        // Anonymous on purpose: the sign-in, sign-up, public event and marketing pages show the name before sign-in.
        app.MapGet("/api/site", (ICurrentOrganisation organisation, HttpContext context) =>
            Results.Ok(SiteDto.Of(organisation, (context.Items[OrganisationResolutionMiddleware.PublicSiteItem] as PublicSite)?.Content)))
            .AllowAnonymous();
        return app;
    }
}
