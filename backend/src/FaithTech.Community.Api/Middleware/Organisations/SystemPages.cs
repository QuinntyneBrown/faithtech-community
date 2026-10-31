using System.Reflection;
using System.Security.Cryptography;
using FaithTech.Community.Api.Middleware.PrivatePreview;

namespace FaithTech.Community.Api.Middleware.Organisations;

public enum SystemPage
{
    UnknownHost,
    Suspended,
}

/// <summary>
/// The neutral pages a host answers with before anything of an organisation runs (L2-131 AC2, AC3, L2-048): embedded
/// unknown-host.html and suspended.html rendered as <see cref="WallPage"/> renders the wall, with inline styles under a
/// fresh CSP nonce. They name no organisation and no product. A request that is not a navigation gets an empty body.
/// </summary>
public static class SystemPages
{
    private static readonly string UnknownHostTemplate = ReadTemplate("unknown-host.html");
    private static readonly string SuspendedTemplate = ReadTemplate("suspended.html");

    public static async Task WriteAsync(HttpContext context, SystemPage page)
    {
        var request = context.Request;
        var response = context.Response;
        response.StatusCode = page == SystemPage.UnknownHost ? StatusCodes.Status404NotFound : StatusCodes.Status503ServiceUnavailable;
        response.Headers.CacheControl = "no-store";

        var readOnly = HttpMethods.IsGet(request.Method) || HttpMethods.IsHead(request.Method);
        var navigation = readOnly && request.Headers.Accept.Any(value => value?.Contains("text/html", StringComparison.OrdinalIgnoreCase) == true);
        if (!navigation)
        {
            return;
        }

        var nonce = Convert.ToBase64String(RandomNumberGenerator.GetBytes(16)).TrimEnd('=').Replace('+', '-').Replace('/', '_');
        context.Items[WallPage.ContentSecurityPolicyItem] =
            $"default-src 'none'; style-src 'nonce-{nonce}'; img-src data:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";
        response.ContentType = "text/html; charset=utf-8";
        if (!HttpMethods.IsHead(request.Method))
        {
            var template = page == SystemPage.UnknownHost ? UnknownHostTemplate : SuspendedTemplate;
            await response.WriteAsync(template.Replace("{{nonce}}", nonce));
        }
    }

    private static string ReadTemplate(string name)
    {
        using var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream($"{typeof(SystemPages).Namespace}.{name}")
            ?? throw new InvalidOperationException($"The system page {name} is not embedded.");
        using var reader = new StreamReader(stream);
        return reader.ReadToEnd();
    }
}
