using FaithTech.Community.Api.Middleware.PrivatePreview;
using FaithTech.Community.Application.PrivatePreview;
using Microsoft.Extensions.Options;

namespace FaithTech.Community.Api.Middleware;

public class SecurityHeadersMiddleware(RequestDelegate next, IOptions<PrivatePreviewOptions> privatePreview)
{
    public Task InvokeAsync(HttpContext context)
    {
        context.Response.OnStarting(() =>
        {
            var headers = context.Response.Headers;
            headers.StrictTransportSecurity = "max-age=31536000; includeSubDomains";
            // A response that sets its own policy (the wall page's nonce policy, an app's HTML) keeps it.
            headers.ContentSecurityPolicy = context.Items[WallPage.ContentSecurityPolicyItem] as string
                ?? "default-src 'none'; frame-ancestors 'none'; base-uri 'none'";
            headers.XContentTypeOptions = "nosniff";
            headers.XFrameOptions = "DENY";
            headers["Referrer-Policy"] = "no-referrer";
            if (privatePreview.Value.Enabled)
            {
                // Nothing behind the wall is for search engines, locked or not (L2-106 AC1).
                headers["X-Robots-Tag"] = "noindex, nofollow";
            }

            return Task.CompletedTask;
        });
        return next(context);
    }
}
