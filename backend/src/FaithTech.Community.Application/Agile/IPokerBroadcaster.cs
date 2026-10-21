namespace FaithTech.Community.Application.Agile;

/// <summary>
/// Tells everyone watching a Planning Poker session that it changed, after the change is saved (L2-038 AC2).
/// The message carries no votes; clients re-read the session, which withholds values until the reveal (ADR 0009).
/// </summary>
public interface IPokerBroadcaster
{
    Task PokerChangedAsync(Guid sessionId, CancellationToken cancellationToken = default);
}
