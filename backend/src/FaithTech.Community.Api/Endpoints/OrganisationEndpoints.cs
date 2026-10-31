using FaithTech.Community.Domain.Organisations;

namespace FaithTech.Community.Api.Endpoints;

public static class OrganisationEndpoints
{
    public sealed record CapabilityDto(string Key, string Description);

    public static IEndpointRouteBuilder MapOrganisationEndpoints(this IEndpointRouteBuilder app)
    {
        // The platform's catalogue, the same in every organisation, for any member (L2-135 AC1).
        app.MapGet("/api/organisation/capabilities", () =>
            Results.Ok(Capability.All.Select(c => new CapabilityDto(c.Key, c.Description))));
        return app;
    }
}
