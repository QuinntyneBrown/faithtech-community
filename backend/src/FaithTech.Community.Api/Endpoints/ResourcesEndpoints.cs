using FaithTech.Community.Application.Resources;
using Microsoft.AspNetCore.Mvc;

namespace FaithTech.Community.Api.Endpoints;

/// <summary>
/// Resources (L2-055 to L2-066). Every endpoint needs a signed-in member; visibility, ownership and the contributor
/// roles are decided by the handlers. Files and thumbnails stream through the API, never from a public URL (ADR 0017).
/// </summary>
public static class ResourcesEndpoints
{
    /// <summary>Twenty files of 100 MB, plus the form fields.</summary>
    private const long UploadRequestLimit = ResourceFileTypes.MaxFiles * ResourceFileTypes.MaxBytes + 1024 * 1024;

    public static IEndpointRouteBuilder MapResourcesEndpoints(this IEndpointRouteBuilder app)
    {
        var resources = app.MapGroup("/api/resources");

        resources.MapGet("", async (string? q, string? type, string? tag, int? page, ListResourcesHandler handler, CancellationToken cancellationToken) =>
        {
            var (result, list) = await handler.HandleAsync(new ListResourcesQuery(q, type, tag, page ?? 1), cancellationToken);
            return result.ToHttp(() => Results.Ok(list));
        });

        resources.MapGet("/tags", async (string? q, ResourceTagsHandler handler, CancellationToken cancellationToken) =>
            Results.Ok(await handler.HandleAsync(q, cancellationToken)));

        resources.MapGet("/{id:guid}", async (Guid id, GetResourceHandler handler, CancellationToken cancellationToken) =>
            await handler.HandleAsync(id, cancellationToken) is { } resource ? Results.Ok(resource) : Results.NotFound());

        resources.MapGet("/{id:guid}/file", async (Guid id, DownloadResourceHandler handler, CancellationToken cancellationToken) =>
        {
            var (result, content) = await handler.FileAsync(id, cancellationToken);
            return result.ToHttp(() => Results.File(content!.Content, content.ContentType, content.FileName));
        });

        resources.MapGet("/{id:guid}/thumbnail", async (Guid id, DownloadResourceHandler handler, CancellationToken cancellationToken) =>
        {
            var (result, content) = await handler.ThumbnailAsync(id, cancellationToken);
            return result.ToHttp(() => Results.File(content!.Content, content.ContentType));
        });

        resources.MapPost("", async (HttpRequest request, AddResourcesHandler handler, CancellationToken cancellationToken) =>
            {
                if (await FormAsync(request, cancellationToken) is not { } form)
                {
                    return NoFiles();
                }

                var command = new AddResourcesCommand(Uploads(form), Fields(form), Text(form, "url"));
                var (result, added) = await handler.HandleAsync(command, cancellationToken);
                return result.ToHttp(() => Results.Created("/api/resources", added));
            })
            .DisableAntiforgery()
            .WithMetadata(new RequestSizeLimitAttribute(UploadRequestLimit), new RequestFormLimitsAttribute { MultipartBodyLengthLimit = UploadRequestLimit });

        resources.MapPost("/links", async (AddLinkCommand command, AddLinkHandler handler, CancellationToken cancellationToken) =>
        {
            var (result, added) = await handler.HandleAsync(command, cancellationToken);
            return result.ToHttp(() => Results.Created($"/api/resources/{added!.Id}", added));
        });

        resources.MapPut("/{id:guid}", async (Guid id, EditResourceCommand command, EditResourceHandler handler, CancellationToken cancellationToken) =>
        {
            var (result, resource) = await handler.HandleAsync(id, command, cancellationToken);
            return result.ToHttp(() => Results.Ok(resource));
        });

        resources.MapPut("/{id:guid}/file", async (Guid id, HttpRequest request, ReplaceFileHandler handler, CancellationToken cancellationToken) =>
            {
                if (await FormAsync(request, cancellationToken) is not { } form)
                {
                    return NoFiles();
                }

                var (result, resource) = await handler.HandleAsync(id, Uploads(form), cancellationToken);
                return result.ToHttp(() => Results.Ok(resource));
            })
            .DisableAntiforgery()
            .WithMetadata(new RequestSizeLimitAttribute(UploadRequestLimit), new RequestFormLimitsAttribute { MultipartBodyLengthLimit = UploadRequestLimit });

        return app;
    }

    /// <summary>The multipart form, or null when the body is not one (an empty or malformed upload).</summary>
    private static async Task<IFormCollection?> FormAsync(HttpRequest request, CancellationToken cancellationToken)
    {
        if (!request.HasFormContentType)
        {
            return null;
        }

        try
        {
            return await request.ReadFormAsync(cancellationToken);
        }
        catch (InvalidDataException)
        {
            return null;
        }
    }

    private static IResult NoFiles() =>
        Results.ValidationProblem(new Dictionary<string, string[]> { ["Files"] = ["Choose at least one file."] });

    private static IReadOnlyList<ResourceUpload> Uploads(IFormCollection form) =>
        [.. form.Files.GetFiles("files").Select(f => new ResourceUpload(f.FileName, f.Length, f.OpenReadStream))];

    private static ResourceFieldsInput Fields(IFormCollection form) => new(
        Text(form, "title"),
        Text(form, "description"),
        Text(form, "type"),
        [.. form["tags"].OfType<string>()],
        Text(form, "visibility"),
        [.. form["memberIds"].OfType<string>().Select(v => Guid.TryParse(v, out var id) ? id : Guid.Empty)],
        [.. form["roles"].OfType<string>()]);

    private static string? Text(IFormCollection form, string key) => form.TryGetValue(key, out var value) ? value.ToString() : null;
}
