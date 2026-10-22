using FaithTech.Community.Api.Middleware.PrivatePreview;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Extensions.FileProviders;

namespace FaithTech.Community.Api.Middleware;

/// <summary>Where the production container keeps the two Angular builds (backend/deploy/api.Dockerfile, ADR 0023).</summary>
public class StaticSitesOptions
{
    public const string Section = "StaticSites";

    /// <summary>The community app's production build, served on the host of <c>WebApp:Origin</c>.</summary>
    public string? AppRoot { get; set; }

    /// <summary>The marketing page's production build, served on the host of <c>Marketing:Origin</c>.</summary>
    public string? MarketingRoot { get; set; }

    /// <summary>Space-separated origins photos load from (Blob storage, ADR 0002), for the apps' img-src.</summary>
    public string? ImageOrigins { get; set; }
}

/// <summary>
/// Serves both Angular builds by host behind the private-preview wall (L2-093). API paths always go on to the API.
/// Nothing is configured in development or in the tests, where the Angular dev servers serve the apps.
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

        var webAppOrigin = configuration["WebApp:Origin"] ?? throw new InvalidOperationException("WebApp:Origin is not configured.");
        var marketingOrigin = configuration["Marketing:Origin"] ?? throw new InvalidOperationException("Marketing:Origin is not configured.");
        var policy = ContentSecurityPolicy(webAppOrigin, options.ImageOrigins);
        Serve(app, new Uri(webAppOrigin).Authority, options.AppRoot, policy);
        Serve(app, new Uri(marketingOrigin).Authority, options.MarketingRoot, policy);
        return app;
    }

    private static void Serve(IApplicationBuilder app, string host, string root, string policy)
    {
        var files = new PhysicalFileProvider(Path.GetFullPath(root));
        var types = new FileExtensionContentTypeProvider();
        types.Mappings[".vtt"] = "text/vtt";
        types.Mappings[".webmanifest"] = "application/manifest+json";

        app.MapWhen(
            context => string.Equals(context.Request.Host.Value, host, StringComparison.OrdinalIgnoreCase)
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
                            file.Context.Items[WallPage.ContentSecurityPolicyItem] = policy;
                        }
                        else
                        {
                            // Private: nothing behind the wall may sit in a shared cache (L2-093 AC2).
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
                    context.Items[WallPage.ContentSecurityPolicyItem] = policy;
                    if (!HttpMethods.IsHead(context.Request.Method))
                    {
                        await context.Response.SendFileAsync(index);
                    }
                });
            });
    }

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
