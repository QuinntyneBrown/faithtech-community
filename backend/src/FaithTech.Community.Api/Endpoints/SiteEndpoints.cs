using FaithTech.Community.Application.Organisations;

namespace FaithTech.Community.Api.Endpoints;

public static class SiteEndpoints
{
    public static IEndpointRouteBuilder MapSiteEndpoints(this IEndpointRouteBuilder app)
    {
        // Anonymous on purpose: the sign-in, sign-up, public event and marketing pages show the name before sign-in.
        app.MapGet("/api/site", (ICurrentOrganisation organisation) => Results.Ok(SiteDto.Of(organisation))).AllowAnonymous();
        return app;
    }
}
