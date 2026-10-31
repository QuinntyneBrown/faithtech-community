using FaithTech.Community.Application.Agile;
using FaithTech.Community.Application.Organisations;
using Microsoft.AspNetCore.SignalR;

namespace FaithTech.Community.Api.Hubs;

/// <summary>Pushes Agile changes to the clients watching them over <see cref="AgileHub"/> (ADR 0012).</summary>
public class SignalRAgileNotifier(IHubContext<AgileHub> hub, ICurrentOrganisation organisation) : IBoardNotifier, IPokerBroadcaster
{
    public Task CardMovedAsync(Guid workspaceId, Guid itemId, string status, CancellationToken cancellationToken = default) =>
        hub.Clients.Group(AgileHub.BoardGroup(organisation.Id, workspaceId)).SendAsync("CardMoved", itemId, status, cancellationToken);

    public Task PokerChangedAsync(Guid sessionId, CancellationToken cancellationToken = default) =>
        hub.Clients.Group(AgileHub.PokerGroup(organisation.Id, sessionId)).SendAsync("PokerChanged", sessionId, cancellationToken);
}
