using FaithTech.Community.Api.Middleware.PrivatePreview;

namespace FaithTech.Community.Api.Middleware;

public class SecurityHeadersMiddleware(RequestDelegate next)
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
            return Task.CompletedTask;
        });
        return next(context);
    }
}
