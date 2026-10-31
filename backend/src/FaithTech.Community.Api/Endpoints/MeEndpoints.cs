using FaithTech.Community.Application.Organisations;

namespace FaithTech.Community.Api.Endpoints;

public static class MeEndpoints
{
    public static IEndpointRouteBuilder MapMeEndpoints(this IEndpointRouteBuilder app)
    {
        // Open to a signed-in non-member (MembershipRequirement), so the app can say why and where they belong.
        app.MapGet("/api/me", async (MeHandler handler, CancellationToken cancellationToken) =>
            await handler.HandleAsync(cancellationToken) switch
            {
                ({ } me, _) => Results.Ok(me),
                (_, var notAMember) => Results.Json(notAMember, statusCode: StatusCodes.Status403Forbidden),
            });
        return app;
    }
}
