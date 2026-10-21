using FaithTech.Community.Application.Agile;
using Microsoft.AspNetCore.SignalR;

namespace FaithTech.Community.Api.Hubs;

/// <summary>Pushes Agile changes to the clients watching them over <see cref="AgileHub"/> (ADR 0009).</summary>
public class SignalRAgileNotifier(IHubContext<AgileHub> hub) : IBoardNotifier
{
    public Task CardMovedAsync(Guid workspaceId, Guid itemId, string status, CancellationToken cancellationToken = default) =>
        hub.Clients.Group(AgileHub.BoardGroup(workspaceId)).SendAsync("CardMoved", itemId, status, cancellationToken);
}
