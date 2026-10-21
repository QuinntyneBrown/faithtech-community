using FaithTech.Community.Application.Admin;

namespace FaithTech.Community.Api.Endpoints;

/// <summary>System Admin user management (L2-039, L2-040). Users are addressed by profile id.</summary>
public static class AdminUsersEndpoints
{
    public static IEndpointRouteBuilder MapAdminUsersEndpoints(this IEndpointRouteBuilder app)
    {
        var users = app.MapGroup("/api/admin/users");

        users.MapPost("/{id:guid}/suspension", async (Guid id, SuspendUserCommand command, SuspensionHandler handler, CancellationToken cancellationToken) =>
                (await handler.SuspendAsync(id, command, cancellationToken)).ToHttp(Results.NoContent))
            .Validate<SuspendUserCommand>();

        users.MapDelete("/{id:guid}/suspension", async (Guid id, SuspensionHandler handler, CancellationToken cancellationToken) =>
            (await handler.ReinstateAsync(id, cancellationToken)).ToHttp(Results.NoContent));

        return app;
    }
}
