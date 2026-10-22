using System.Security.Cryptography;
using System.Text;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.PrivatePreview;
using Microsoft.Extensions.Options;

namespace FaithTech.Community.Api.Middleware.PrivatePreview;

/// <summary>
/// The private-preview wall (ADR 0026, L2-100 to L2-104). Runs before routing, the exception handler and static files,
/// so until the visitor holds a valid unlock nothing but the exempt paths is reached and every response is one the
/// gate writes itself: the wall page for a navigation, an empty 403 for anything else, never a redirect.
/// </summary>
public class PrivatePreviewGateMiddleware(
    RequestDelegate next,
    IOptions<PrivatePreviewOptions> options,
    IOptions<WebAppOptions> webApp,
    IOptions<MarketingOptions> marketing)
{
    public const string UnlockPath = "/__wall/unlock";
    public const string UnlockCookie = "__Secure-unlock";

    private const int MaxFormBytes = 4096;

    public async Task InvokeAsync(HttpContext context)
    {
        if (!options.Value.Enabled)
        {
            await next(context);
            return;
        }

        var request = context.Request;
        var readOnly = HttpMethods.IsGet(request.Method) || HttpMethods.IsHead(request.Method);
        if (readOnly && request.Path == "/robots.txt")
        {
            context.Response.ContentType = "text/plain";
            await context.Response.WriteAsync("User-agent: *\nDisallow: /\n");
            return;
        }

        if ((readOnly && request.Path == "/health/live")
            || context.RequestServices.GetRequiredService<IUnlockTokens>().IsValid(request.Cookies[UnlockCookie]))
        {
            await next(context);
            return;
        }

        // A CORS preflight never carries cookies; one from our own origins goes on to the CORS policy (L2-101 AC3).
        if (IsOwnPreflight(request))
        {
            await next(context);
            return;
        }

        if (HttpMethods.IsPost(request.Method) && request.Path == UnlockPath)
        {
            await UnlockAsync(context);
            return;
        }

        if (readOnly && IsNavigation(request))
        {
            await WallPage.WriteAsync(context, WallState.Default, request.Path + request.QueryString, StatusCodes.Status403Forbidden);
            return;
        }

        context.Response.StatusCode = StatusCodes.Status403Forbidden;
    }

    private async Task UnlockAsync(HttpContext context)
    {
        var request = context.Request;
        IFormCollection form = FormCollection.Empty;
        if (request.HasFormContentType && request.ContentLength is <= MaxFormBytes)
        {
            form = await request.ReadFormAsync();
        }

        var returnUrl = ReturnUrls.Local(form["returnUrl"]);
        var outcome = context.RequestServices.GetRequiredService<UnlockHandler>().Handle(
            form["passphrase"],
            IsGenuine(request, form["csrf"]),
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown");

        switch (outcome.Status)
        {
            case UnlockStatus.Unlocked:
                context.Response.Cookies.Append(UnlockCookie, outcome.Token!, new CookieOptions
                {
                    HttpOnly = true,
                    Secure = true,
                    SameSite = SameSiteMode.Lax,
                    Path = "/",
                    Domain = string.IsNullOrWhiteSpace(options.Value.CookieDomain) ? null : options.Value.CookieDomain,
                    Expires = outcome.ExpiresAt,
                    MaxAge = options.Value.UnlockLifetime,
                    IsEssential = true,
                });
                context.Response.StatusCode = StatusCodes.Status303SeeOther;
                context.Response.Headers.Location = returnUrl;
                context.Response.Headers.CacheControl = "no-store";
                break;
            case UnlockStatus.LockedOut:
                await WallPage.WriteAsync(context, WallState.LockedOut, returnUrl, StatusCodes.Status429TooManyRequests);
                break;
            case UnlockStatus.Failed:
                await WallPage.WriteAsync(context, WallState.Error, returnUrl, StatusCodes.Status500InternalServerError);
                break;
            default:
                await WallPage.WriteAsync(context, WallState.Invalid, returnUrl, StatusCodes.Status403Forbidden);
                break;
        }
    }

    /// <summary>
    /// The form came from our own wall page: its CSRF value matches the host-only, SameSite=Strict cookie, and the
    /// browser says the post came from this origin. Under Referrer-Policy: no-referrer browsers send "Origin: null" on
    /// a same-origin form post, so a null or missing Origin counts only when Sec-Fetch-Site (if sent) is same-origin.
    /// </summary>
    private static bool IsGenuine(HttpRequest request, string? csrf)
    {
        var cookie = request.Cookies[WallPage.CsrfCookie];
        var tokenMatches = !string.IsNullOrEmpty(cookie) && !string.IsNullOrEmpty(csrf)
            && CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(cookie), Encoding.UTF8.GetBytes(csrf));
        var origin = request.Headers.Origin.ToString();
        var fetchSite = request.Headers["Sec-Fetch-Site"].ToString();
        var sameOrigin = (fetchSite.Length == 0 || fetchSite == "same-origin")
            && (origin.Length == 0 || origin == "null"
                || (Uri.TryCreate(origin, UriKind.Absolute, out var uri) && string.Equals(uri.Authority, request.Host.Value, StringComparison.OrdinalIgnoreCase)));
        return tokenMatches && sameOrigin;
    }

    private bool IsOwnPreflight(HttpRequest request) =>
        HttpMethods.IsOptions(request.Method)
        && request.Headers.ContainsKey("Access-Control-Request-Method")
        && request.Headers.Origin.ToString() is { Length: > 0 } origin
        && (string.Equals(origin, webApp.Value.Origin, StringComparison.OrdinalIgnoreCase)
            || string.Equals(origin, marketing.Value.Origin, StringComparison.OrdinalIgnoreCase));

    private static bool IsNavigation(HttpRequest request) =>
        request.Headers.Accept.Any(value => value?.Contains("text/html", StringComparison.OrdinalIgnoreCase) == true);
}
