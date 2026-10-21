using FaithTech.Community.Application.Common;

namespace FaithTech.Community.Api.Endpoints;

public static class MeEndpoints
{
    public static IEndpointRouteBuilder MapMeEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/me", (ICurrentUser user) => Results.Ok(new
        {
            Id = user.UserId,
            Roles = user.Roles.Select(r => r.ToString()),
        }));
        return app;
    }
}
