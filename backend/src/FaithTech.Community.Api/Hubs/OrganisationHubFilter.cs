using FaithTech.Community.Api.Middleware.Organisations;
using FaithTech.Community.Application.Organisations;
using FaithTech.Community.Domain.Organisations;
using Microsoft.AspNetCore.SignalR;

namespace FaithTech.Community.Api.Hubs;

/// <summary>
/// SignalR runs each hub call in a scope of its own, outside the request pipeline, so this puts the organisation the
/// connection's host resolved to into that scope before the hub runs (ADR 0032).
/// </summary>
public class OrganisationHubFilter : IHubFilter
{
    public ValueTask<object?> InvokeMethodAsync(HubInvocationContext context, Func<HubInvocationContext, ValueTask<object?>> next)
    {
        Scope(context.Context, context.ServiceProvider);
        return next(context);
    }

    public Task OnConnectedAsync(HubLifetimeContext context, Func<HubLifetimeContext, Task> next)
    {
        Scope(context.Context, context.ServiceProvider);
        return next(context);
    }

    public Task OnDisconnectedAsync(HubLifetimeContext context, Exception? exception, Func<HubLifetimeContext, Exception?, Task> next)
    {
        Scope(context.Context, context.ServiceProvider);
        return next(context, exception);
    }

    private static void Scope(HubCallerContext caller, IServiceProvider services)
    {
        var organisation = caller.GetHttpContext()?.Items[OrganisationResolutionMiddleware.OrganisationItem] as Organisation
            ?? throw new HubException("No organisation was resolved for this connection.");
        services.GetRequiredService<OrganisationScope>().Set(organisation);
    }
}
