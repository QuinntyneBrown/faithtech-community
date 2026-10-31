using FaithTech.Community.Api.Middleware.Organisations;
using FaithTech.Community.Api.Middleware.PrivatePreview;
using FaithTech.Community.Application.Organisations;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Extensions.FileProviders;

namespace FaithTech.Community.Api.Middleware;

/// <summary>Where the production container keeps the two Angular builds (backend/deploy/api.Dockerfile, ADR 0026).</summary>
public class StaticSitesOptions
{
    public const string Section = "StaticSites";

    /// <summary>The community app's production build, served on every organisation's community host.</summary>
    public string? AppRoot { get; set; }

    /// <summary>The marketing page's production build, served on every public host (<c>Marketing:Sites</c>).</summary>
    public string? MarketingRoot { get; set; }

    /// <summary>Space-separated origins photos load from (Blob storage, ADR 0002), for the apps' img-src.</summary>
    public string? ImageOrigins { get; set; }
}

/// <summary>
/// Serves both Angular builds behind the private-preview wall (L2-108): the community build on a community host and
/// the marketing build on a public host, as host resolution recorded it (L2-134 AC3). API paths always go on to the
/// API. Nothing is configured in development or in most tests, where the Angular dev servers serve the apps.
/// </summary>
public static class StaticSitesSetup
{
    private static readonly string[] ApiPaths = ["/api", "/connect", "/.well-known", "/hubs", "/health"];

    public static IApplicationBuilder UseStaticSites(this IApplicationBuilder app, IConfiguration configuration)
    {
        var options = configuration.GetSection(StaticSitesOptions.Section).Get<StaticSitesOptions>() ?? new StaticSitesOptions();
        if (string.IsNullOrWhiteSpace(options.AppRoot) || string.IsNullOrWhiteSpace(options.MarketingRoot))
        {
            return app;
        }

        Serve(app, HostKind.Community, options.AppRoot, options.ImageOrigins);
        Serve(app, HostKind.Public, options.MarketingRoot, options.ImageOrigins);
        return app;
    }

    private static void Serve(IApplicationBuilder app, HostKind kind, string root, string? imageOrigins)
    {
        var files = new PhysicalFileProvider(Path.GetFullPath(root));
        var types = new FileExtensionContentTypeProvider();
        types.Mappings[".vtt"] = "text/vtt";
        types.Mappings[".webmanifest"] = "application/manifest+json";

        app.MapWhen(
            context => context.Items[OrganisationResolutionMiddleware.HostKindItem] is HostKind hostKind && hostKind == kind
                && !ApiPaths.Any(path => context.Request.Path.StartsWithSegments(path, StringComparison.OrdinalIgnoreCase)),
            site =>
            {
                site.UseStaticFiles(new StaticFileOptions
                {
                    FileProvider = files,
                    ContentTypeProvider = types,
                    OnPrepareResponse = file =>
                    {
                        if (file.File.Name.EndsWith(".html", StringComparison.OrdinalIgnoreCase))
                        {
                            file.Context.Response.Headers.CacheControl = "no-cache";
                            file.Context.Items[WallPage.ContentSecurityPolicyItem] = Policy(file.Context, imageOrigins);
                        }
                        else
                        {
                            // Private: nothing behind the wall may sit in a shared cache (L2-108 AC2).
                            file.Context.Response.Headers.CacheControl = "private, max-age=31536000, immutable";
                        }
                    },
                });
                site.Run(async context =>
                {
                    var index = files.GetFileInfo("index.html");
                    var navigation = (HttpMethods.IsGet(context.Request.Method) || HttpMethods.IsHead(context.Request.Method))
                        && context.Request.Headers.Accept.Any(value => value?.Contains("text/html", StringComparison.OrdinalIgnoreCase) == true);
                    if (!navigation || !index.Exists)
                    {
                        context.Response.StatusCode = StatusCodes.Status404NotFound;
                        return;
                    }

                    // An app route such as /events/42: the SPA's index.html, which routes in the browser.
                    context.Response.ContentType = "text/html; charset=utf-8";
                    context.Response.Headers.CacheControl = "no-cache";
                    context.Items[WallPage.ContentSecurityPolicyItem] = Policy(context, imageOrigins);
                    if (!HttpMethods.IsHead(context.Request.Method))
                    {
                        await context.Response.SendFileAsync(index);
                    }
                });
            });
    }

    /// <summary>Calls go to the community origin of the organisation the host belongs to, never another's.</summary>
    private static string Policy(HttpContext context, string? imageOrigins) =>
        ContentSecurityPolicy(context.RequestServices.GetRequiredService<ICurrentOrganisation>().Origin, imageOrigins);

    /// <summary>
    /// The apps' policy: scripts only from this origin; Angular's component styles need inline styles; photos come
    /// from Blob storage; the marketing page calls the community origin, and live updates use its WebSocket.
    /// </summary>
    private static string ContentSecurityPolicy(string webAppOrigin, string? imageOrigins)
    {
        var socketOrigin = webAppOrigin.Replace("https://", "wss://", StringComparison.OrdinalIgnoreCase)
            .Replace("http://", "ws://", StringComparison.OrdinalIgnoreCase);
        return string.Join("; ",
            "default-src 'self'",
            "script-src 'self'",
            "style-src 'self' 'unsafe-inline'",
            $"img-src 'self' data: blob: {imageOrigins}".TrimEnd(),
            "media-src 'self' blob:",
            "font-src 'self' data:",
            $"connect-src 'self' {webAppOrigin} {socketOrigin}",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            $"form-action 'self' {webAppOrigin}",
            "object-src 'none'");
    }
}
