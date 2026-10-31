using FaithTech.Community.Application.Organisations;
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
        // The organisation's names and its roles that are not archived, for every member's pickers (L2-136 AC8).
        app.MapGet("/api/organisation", async (GetOrganisationHandler handler, CancellationToken cancellationToken) =>
            Results.Ok(await handler.HandleAsync(cancellationToken)));
        // The General settings, for ManageOrganisationSettings (L2-147 AC3).
        app.MapPut("/api/organisation", async (UpdateOrganisationCommand command, UpdateOrganisationHandler handler, CancellationToken cancellationToken) =>
                (await handler.HandleAsync(command, cancellationToken)).ToHttp(() => Results.Ok()))
            .Validate<UpdateOrganisationCommand>();
        return app;
    }
}
