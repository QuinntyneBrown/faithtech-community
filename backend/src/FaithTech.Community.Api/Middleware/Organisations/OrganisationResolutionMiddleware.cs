using System.Net;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Organisations;
using FaithTech.Community.Domain.Organisations;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.Extensions.Options;

namespace FaithTech.Community.Api.Middleware.Organisations;

/// <summary>Whether a host serves an organisation's community app and API, or its public marketing page.</summary>
public enum HostKind
{
    Community,
    Public,
}

/// <summary>
/// Resolves the request host to its organisation (ADR 0032, L2-131). Runs after the private-preview wall and before
/// static files, CORS, authentication and routing, so a host that maps to no active organisation reaches nothing:
/// an unknown host answers 404 and a suspended organisation's host 503, each with its neutral page. Only the host
/// decides; a token, header, cookie, query string or body naming an organisation is never read.
/// </summary>
public class OrganisationResolutionMiddleware(
    RequestDelegate next,
    IOptions<PlatformOptions> platform,
    IOptions<MarketingOptions> marketing,
    IHostEnvironment environment)
{
    public const string OrganisationItem = "Organisation";
    public const string HostKindItem = "HostKind";

    public async Task InvokeAsync(HttpContext context, IOrganisationResolver resolver, OrganisationScope scope)
    {
        var request = context.Request;
        if ((HttpMethods.IsGet(request.Method) || HttpMethods.IsHead(request.Method)) && request.Path == "/health/live")
        {
            await next(context);
            return;
        }

        var (organisation, kind) = await ResolveAsync(request, resolver, context.RequestAborted);
        if (organisation is null || organisation.Status == OrganisationStatus.Provisioning)
        {
            await RefuseAsync(context, SystemPage.UnknownHost);
            return;
        }

        if (organisation.Status == OrganisationStatus.Suspended)
        {
            await RefuseAsync(context, SystemPage.Suspended);
            return;
        }

        // Every query and save in this request is scoped to it from here on (L2-130).
        scope.Set(organisation);
        context.Items[OrganisationItem] = organisation;
        context.Items[HostKindItem] = kind;
        await next(context);
    }

    private async Task<(Organisation? Organisation, HostKind Kind)> ResolveAsync(
        HttpRequest request, IOrganisationResolver resolver, CancellationToken cancellationToken)
    {
        // The marketing page's host belongs to the default organisation until public hosts are configured per site.
        if (IsMarketingHost(request))
        {
            return (await resolver.ResolveBySlugAsync(platform.Value.DefaultOrganisationSlug, cancellationToken), HostKind.Public);
        }

        // Development (and the test host) serve the default organisation on loopback names (L2-131 AC4).
        if (IsLocal() && IsLoopback(request.Host.Host))
        {
            return (await resolver.ResolveBySlugAsync(platform.Value.DefaultOrganisationSlug, cancellationToken), HostKind.Community);
        }

        return (await resolver.ResolveByHostAsync(request.Host.Host, cancellationToken), HostKind.Community);
    }

    private bool IsMarketingHost(HttpRequest request) =>
        Uri.TryCreate(marketing.Value.Origin, UriKind.Absolute, out var origin)
        && string.Equals(origin.Authority, request.Host.Value, StringComparison.OrdinalIgnoreCase);

    private bool IsLocal() => environment.IsDevelopment() || environment.IsEnvironment("Testing");

    private static bool IsLoopback(string host) =>
        string.Equals(host, "localhost", StringComparison.OrdinalIgnoreCase)
        || host.EndsWith(".localhost", StringComparison.OrdinalIgnoreCase)
        || (IPAddress.TryParse(host.Trim('[', ']'), out var address) && IPAddress.IsLoopback(address));

    private static Task RefuseAsync(HttpContext context, SystemPage page)
    {
        // The neutral answer is the whole response: no problem details body from the status code pages.
        if (context.Features.Get<IStatusCodePagesFeature>() is { } statusCodePages)
        {
            statusCodePages.Enabled = false;
        }

        return SystemPages.WriteAsync(context, page);
    }
}
