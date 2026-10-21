using FaithTech.Community.Application.Profiles;
using Microsoft.AspNetCore.Mvc;

namespace FaithTech.Community.Api.Endpoints;

/// <summary>Profiles for signed-in members (L2-005, L2-006, L2-007). Every route requires authentication.</summary>
public static class ProfilesEndpoints
{
    private const long PhotoRequestLimit = 10 * 1024 * 1024;

    public static IEndpointRouteBuilder MapProfilesEndpoints(this IEndpointRouteBuilder app)
    {
        var profiles = app.MapGroup("/api/profiles");

        profiles.MapGet("/me", async (GetProfileHandler handler, CancellationToken cancellationToken) =>
            await handler.HandleOwnAsync(cancellationToken) is { } profile ? Results.Ok(profile) : Results.NotFound());

        profiles.MapGet("/{id:guid}", async (Guid id, GetProfileHandler handler, CancellationToken cancellationToken) =>
            await handler.HandleAsync(id, cancellationToken) is { } profile ? Results.Ok(profile) : Results.NotFound());

        profiles.MapPut("/{id:guid}", async (Guid id, UpdateProfileCommand command, UpdateProfileHandler handler, CancellationToken cancellationToken) =>
            (await handler.HandleAsync(id, command, cancellationToken)).ToHttp(Results.NoContent))
            .Validate<UpdateProfileCommand>();

        // Bearer-token API, so no antiforgery; up to 10 MB is read so a too-large photo gets the inline 400.
        profiles.MapPost("/{id:guid}/photos", async (
                Guid id, IFormFile? file, [FromForm] string? altText, UploadPhotoHandler handler, CancellationToken cancellationToken) =>
            {
                if (file is null)
                {
                    return Results.ValidationProblem(new Dictionary<string, string[]> { ["File"] = ["Choose a photo to upload."] });
                }

                await using var content = file.OpenReadStream();
                var (result, photo) = await handler.HandleAsync(
                    id, new UploadPhotoCommand(content, file.FileName, file.Length, altText), cancellationToken);
                return result.ToHttp(() => Results.Created($"/api/profiles/{id}", photo));
            })
            .DisableAntiforgery()
            .WithMetadata(new RequestSizeLimitAttribute(PhotoRequestLimit), new RequestFormLimitsAttribute { MultipartBodyLengthLimit = PhotoRequestLimit });

        return app;
    }
}
