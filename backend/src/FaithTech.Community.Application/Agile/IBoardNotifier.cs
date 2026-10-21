namespace FaithTech.Community.Application.Agile;

/// <summary>
/// Tells everyone watching a workspace's board that a card moved (L2-034 AC2), after the move is saved.
/// Implemented over SignalR in the Api (ADR 0009); tests record the calls instead.
/// </summary>
public interface IBoardNotifier
{
    Task CardMovedAsync(Guid workspaceId, Guid itemId, string status, CancellationToken cancellationToken = default);
}
