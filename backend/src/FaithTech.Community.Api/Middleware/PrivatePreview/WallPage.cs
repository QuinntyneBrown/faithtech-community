using System.Net;
using System.Reflection;
using System.Security.Cryptography;

namespace FaithTech.Community.Api.Middleware.PrivatePreview;

public enum WallState
{
    Default,
    Invalid,
    LockedOut,
    Error,
}

/// <summary>
/// Renders the wall page from the embedded wall.html: inline styles and script under a fresh CSP nonce, a fresh
/// CSRF value (also set as the host-only <see cref="CsrfCookie"/>) and the return URL. Nothing names the product.
/// </summary>
public static class WallPage
{
    public const string CsrfCookie = "__Host-wall";

    /// <summary>The <see cref="HttpContext.Items"/> key SecurityHeadersMiddleware reads a response's own CSP from.</summary>
    public const string ContentSecurityPolicyItem = "ContentSecurityPolicy";

    private const string WarningIcon =
        "<svg class=\"icon\" aria-hidden=\"true\" viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 8v4M12 16h.01\"/></svg>";

    private static readonly string Template = ReadTemplate();

    public static async Task WriteAsync(HttpContext context, WallState state, string returnUrl, int statusCode)
    {
        var nonce = RandomValue(16);
        var csrf = RandomValue(32);
        var html = Template
            .Replace("{{nonce}}", nonce)
            .Replace("{{csrf}}", csrf)
            .Replace("{{returnUrl}}", WebUtility.HtmlEncode(returnUrl))
            .Replace("{{alert}}", state switch
            {
                WallState.LockedOut => Alert("warning", "Too many attempts", "Wait a few minutes, then try again."),
                WallState.Error => Alert("danger", "Something went wrong", "Try again in a moment."),
                _ => string.Empty,
            })
            .Replace("{{fieldAttributes}}", state == WallState.Invalid ? " aria-invalid=\"true\" aria-describedby=\"passphrase-error\" autofocus" : string.Empty)
            .Replace("{{fieldError}}", state == WallState.Invalid
                ? "<div class=\"field__error\" id=\"passphrase-error\">That passphrase didn’t work. Check it and try again.</div>"
                : string.Empty);

        context.Items[ContentSecurityPolicyItem] =
            $"default-src 'none'; style-src 'nonce-{nonce}'; script-src 'nonce-{nonce}'; img-src data:; form-action 'self'; frame-ancestors 'none'; base-uri 'none'";
        context.Response.Cookies.Append(CsrfCookie, csrf, new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.Strict,
            Path = "/",
            IsEssential = true,
        });
        context.Response.StatusCode = statusCode;
        context.Response.ContentType = "text/html; charset=utf-8";
        context.Response.Headers.CacheControl = "no-store";
        if (!HttpMethods.IsHead(context.Request.Method))
        {
            await context.Response.WriteAsync(html);
        }
    }

    private static string Alert(string variant, string title, string text) =>
        $"<div class=\"alert alert--{variant}\" role=\"alert\">{WarningIcon}<div class=\"alert__body\"><div class=\"alert__title\">{title}</div><p>{text}</p></div></div>";

    private static string RandomValue(int bytes) => Convert.ToBase64String(RandomNumberGenerator.GetBytes(bytes))
        .TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private static string ReadTemplate()
    {
        using var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(typeof(WallPage).Namespace + ".wall.html")
            ?? throw new InvalidOperationException("The wall page template is not embedded.");
        using var reader = new StreamReader(stream);
        return reader.ReadToEnd();
    }
}
