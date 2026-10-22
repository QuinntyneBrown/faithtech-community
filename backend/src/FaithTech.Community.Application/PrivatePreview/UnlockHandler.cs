using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace FaithTech.Community.Application.PrivatePreview;

public enum UnlockStatus
{
    Unlocked,
    Refused,
    LockedOut,
    Failed,
}

public record UnlockOutcome(UnlockStatus Status, string? Token = null, DateTimeOffset? ExpiresAt = null);

/// <summary>
/// Checks the owner's passphrase (L2-087). Every refusal costs one full hash, whether the passphrase was wrong, empty,
/// too long or the form was forged, so neither the response nor its timing says which check failed. A locked-out
/// address is not checked at all (L2-088). Nothing typed is ever logged.
/// </summary>
public class UnlockHandler(
    UnlockAttempts attempts,
    IPassphraseHasher hasher,
    IUnlockTokens tokens,
    IOptions<PrivatePreviewOptions> options,
    TimeProvider time,
    ILogger<UnlockHandler> logger)
{
    public const int MaxPassphraseLength = 1024;

    public UnlockOutcome Handle(string? passphrase, bool formIsGenuine, string clientAddress)
    {
        if (attempts.IsLockedOut(clientAddress))
        {
            logger.LogWarning("Wall unlock locked out for {ClientAddress}", clientAddress);
            return new UnlockOutcome(UnlockStatus.LockedOut);
        }

        bool matches;
        try
        {
            // A missing or oversized passphrase still pays for a hash: of a fixed stand-in, which never matches.
            var candidate = passphrase is { Length: > 0 and <= MaxPassphraseLength } ? passphrase : string.Empty;
            matches = hasher.Verify(candidate, options.Value.PassphraseHash) && candidate.Length > 0;
        }
        catch (Exception exception)
        {
            logger.LogError(exception, "Wall unlock could not be checked for {ClientAddress}", clientAddress);
            return new UnlockOutcome(UnlockStatus.Failed);
        }

        if (!matches || !formIsGenuine)
        {
            var failures = attempts.RecordFailure(clientAddress);
            logger.LogWarning("Wall unlock refused for {ClientAddress} ({RecentFailures} recent failures)", clientAddress, failures);
            return new UnlockOutcome(UnlockStatus.Refused);
        }

        attempts.RecordSuccess(clientAddress);
        var expiresAt = time.GetUtcNow() + options.Value.UnlockLifetime;
        logger.LogInformation("Wall unlocked for {ClientAddress}", clientAddress);
        return new UnlockOutcome(UnlockStatus.Unlocked, tokens.Issue(expiresAt), expiresAt);
    }
}
