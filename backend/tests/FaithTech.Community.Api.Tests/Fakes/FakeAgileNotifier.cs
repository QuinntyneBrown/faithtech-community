using System.Collections.Concurrent;
using FaithTech.Community.Application.Agile;

namespace FaithTech.Community.Api.Tests.Fakes;

/// <summary>Records what the agile handlers would push to open viewers, instead of a SignalR hub.</summary>
public class FakeAgileNotifier : IBoardNotifier, IPokerBroadcaster
{
    public ConcurrentQueue<(Guid WorkspaceId, Guid ItemId, string Status)> CardMoves { get; } = new();

    public ConcurrentQueue<Guid> PokerChanges { get; } = new();

    public Task PokerChangedAsync(Guid sessionId, CancellationToken cancellationToken = default)
    {
        PokerChanges.Enqueue(sessionId);
        return Task.CompletedTask;
    }

    public Task CardMovedAsync(Guid workspaceId, Guid itemId, string status, CancellationToken cancellationToken = default)
    {
        CardMoves.Enqueue((workspaceId, itemId, status));
        return Task.CompletedTask;
    }
}
