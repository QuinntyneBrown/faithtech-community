using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Organisations.Platform;
using FaithTech.Community.Domain.Organisations;
using Microsoft.AspNetCore.Diagnostics;

namespace FaithTech.Community.Api.Endpoints;

/// <summary>
/// The operator API (L2-148). Served on every resolved host, it never reads the host's organisation; to anyone but a
/// platform operator every route is an empty 404, so the surface is not revealed (L2-148 AC2).
/// </summary>
public static class PlatformEndpoints
{
    public static IEndpointRouteBuilder MapPlatformEndpoints(this IEndpointRouteBuilder app)
    {
        // Anonymous at the policy level, so no 401 or 403 reveals the routes: RequireOperator answers instead.
        var platform = app.MapGroup("/api/platform").AllowAnonymous().AddEndpointFilter(RequireOperator);

        platform.MapGet("/audit", async (int? page, int? pageSize, GetPlatformAuditHandler handler, CancellationToken cancellationToken) =>
            Results.Ok(await handler.HandleAsync(page ?? 1, pageSize ?? GetPlatformAuditHandler.DefaultPageSize, cancellationToken)));

        platform.MapPost("/organisations", async (ProvisionOrganisationCommand command, ProvisionOrganisationHandler handler, CancellationToken cancellationToken) =>
        {
            var (result, outcome, summary) = await handler.HandleAsync(command, cancellationToken);
            return result.ToHttp(() => outcome == ProvisionOutcome.Created
                ? Results.Created($"/api/platform/organisations/{summary!.Slug}", summary)
                : Results.Ok(summary));
        }).Validate<ProvisionOrganisationCommand>();

        platform.MapGet("/organisations/{slug}", async (string slug, GetOrganisationSummaryHandler handler, CancellationToken cancellationToken) =>
            await handler.HandleAsync(slug, cancellationToken) is { } summary ? Results.Ok(summary) : EmptyNotFound());

        platform.MapPost("/accounts/{email}/lock", async (string email, LockAccountCommand command, LockAccountHandler handler, CancellationToken cancellationToken) =>
            (await handler.LockAsync(email, command, cancellationToken)).ToHttp(Results.NoContent));

        platform.MapPost("/accounts/{email}/unlock", async (string email, LockAccountHandler handler, CancellationToken cancellationToken) =>
            (await handler.UnlockAsync(email, cancellationToken)).ToHttp(Results.NoContent));

        return app;
    }

    private static async ValueTask<object?> RequireOperator(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        var services = context.HttpContext.RequestServices;
        if (services.GetRequiredService<ICurrentUser>().OperatorEmail is not { } email)
        {
            return EmptyNotFound(context.HttpContext);
        }

        services.GetRequiredService<PlatformActor>().Set(email, PlatformAuditSource.Api);
        return await next(context);
    }

    private static IResult EmptyNotFound(HttpContext? context = null)
    {
        // The status code pages would otherwise write a problem body that says something is here.
        if (context?.Features.Get<IStatusCodePagesFeature>() is { } statusCodePages)
        {
            statusCodePages.Enabled = false;
        }

        return Results.StatusCode(StatusCodes.Status404NotFound);
    }
}
