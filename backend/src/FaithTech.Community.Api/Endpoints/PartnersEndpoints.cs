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

        return app;
    }
}
