using FaithTech.Community.Application.Partners;

namespace FaithTech.Community.Api.Endpoints;

/// <summary>The shared partner pipeline (L2-017, L2-018). Lead roles, Staff and System Admin read; Staff never write.</summary>
public static class PartnersEndpoints
{
    public static IEndpointRouteBuilder MapPartnersEndpoints(this IEndpointRouteBuilder app)
    {
        var partners = app.MapGroup("/api/partners");

        partners.MapGet("", async (ManagePartnersHandler handler, CancellationToken cancellationToken) =>
            await handler.BoardAsync(cancellationToken) is { } board ? Results.Ok(board) : Results.Forbid());

        partners.MapGet("/owners", async (ManagePartnersHandler handler, CancellationToken cancellationToken) =>
            await handler.OwnersAsync(cancellationToken) is { } owners ? Results.Ok(owners) : Results.Forbid());

        partners.MapPost("", async (PartnerCommand command, ManagePartnersHandler handler, CancellationToken cancellationToken) =>
            {
                var (result, partner) = await handler.CreateAsync(command, cancellationToken);
                return result.ToHttp(() => Results.Created($"/api/partners/{partner!.Id}", partner));
            })
            .Validate<PartnerCommand>();

        partners.MapGet("/{id:guid}", async (Guid id, ManagePartnersHandler handler, CancellationToken cancellationToken) =>
        {
            var (result, partner) = await handler.GetAsync(id, cancellationToken);
            return result.ToHttp(() => Results.Ok(partner));
        });

        partners.MapPut("/{id:guid}", async (Guid id, PartnerCommand command, ManagePartnersHandler handler, CancellationToken cancellationToken) =>
            {
                var (result, partner) = await handler.UpdateAsync(id, command, cancellationToken);
                return result.ToHttp(() => Results.Ok(partner));
            })
            .Validate<PartnerCommand>();

        partners.MapPost("/{id:guid}/stage", async (Guid id, MovePartnerCommand command, MovePartnerHandler handler, CancellationToken cancellationToken) =>
            {
                var (result, partner) = await handler.MoveAsync(id, command, cancellationToken);
                return result.ToHttp(() => Results.Ok(partner));
            })
            .Validate<MovePartnerCommand>();

        // The shared activity timeline (L2-085, L2-086). Logged entries are never edited or deleted.
        partners.MapGet("/{id:guid}/activities", async (Guid id, string? kind, string? before, PartnerTimelineHandler handler, CancellationToken cancellationToken) =>
        {
            var (result, page) = await handler.ListAsync(id, kind, before, cancellationToken);
            return result.ToHttp(() => Results.Ok(page));
        });

        partners.MapPost("/{id:guid}/activities", async (Guid id, LogPartnerActivityCommand command, LogPartnerActivityHandler handler, CancellationToken cancellationToken) =>
            {
                var (result, activity) = await handler.LogAsync(id, command, cancellationToken);
                return result.ToHttp(() => Results.Created($"/api/partners/{id}/activities/{activity!.Id}", activity));
            })
            .Validate<LogPartnerActivityCommand>();

        // Possible duplicates and "Not the same" (L2-088, ADR 0023).
        partners.MapGet("/{id:guid}/duplicates", async (Guid id, PartnerDuplicatesHandler handler, CancellationToken cancellationToken) =>
        {
            var (result, duplicates) = await handler.ListAsync(id, cancellationToken);
            return result.ToHttp(() => Results.Ok(duplicates));
        });

        partners.MapPost("/{id:guid}/duplicates/{otherId:guid}/dismissal", async (Guid id, Guid otherId, PartnerDuplicatesHandler handler, CancellationToken cancellationToken) =>
            (await handler.DismissAsync(id, otherId, cancellationToken)).ToHttp(Results.NoContent));

        // Merge keeps one partner and archives the other (L2-089, L2-090, ADR 0024).
        partners.MapPost("/{keepId:guid}/merge", async (Guid keepId, MergePartnersCommand command, MergePartnersHandler handler, CancellationToken cancellationToken) =>
            {
                var (result, partner) = await handler.MergeAsync(keepId, command, cancellationToken);
                return result.ToHttp(() => Results.Ok(partner));
            })
            .Validate<MergePartnersCommand>();

        return app;
    }
}
