using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Identity;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Organisations.Platform;

/// <summary>POST /api/platform/accounts/{email}/lock: why the account is locked.</summary>
public record LockAccountCommand(string? Reason);

/// <summary>
/// Locks and unlocks an account across the platform for an operator (L2-148 AC5): a locked account is refused on every
/// host with the suspended-account message and every session it holds is revoked (L2-132 AC6). Distinct from membership
/// suspension, which an organisation applies to one profile. Each action goes to the platform audit log (AC4).
/// </summary>
public class LockAccountHandler(IApplicationDbContext db, ITokenRevocation revocation, IPlatformAuditLog audit, TimeProvider time)
{
    public const int MaxReasonLength = 500;

    public async Task<Result> LockAsync(string email, LockAccountCommand command, CancellationToken cancellationToken = default)
    {
        var reason = command.Reason?.Trim();
        if (string.IsNullOrEmpty(reason))
        {
            return Result.Invalid(nameof(LockAccountCommand.Reason), "Enter a reason.");
        }

        if (reason.Length > MaxReasonLength)
        {
            return Result.Invalid(nameof(LockAccountCommand.Reason), $"Use {MaxReasonLength} characters or fewer.");
        }

        if (await FindAsync(email, cancellationToken) is not { } user)
        {
            return Result.NotFound();
        }

        user.Lock(reason, time.GetUtcNow().UtcDateTime);
        audit.Record("account.locked", null, user.Email!, new { Reason = reason });
        await db.SaveChangesAsync(cancellationToken);
        await revocation.RevokeAllAsync(user.Id, cancellationToken);
        return Result.Ok();
    }

    public async Task<Result> UnlockAsync(string email, CancellationToken cancellationToken = default)
    {
        if (await FindAsync(email, cancellationToken) is not { } user)
        {
            return Result.NotFound();
        }

        user.Unlock();
        audit.Record("account.unlocked", null, user.Email!, null);
        await db.SaveChangesAsync(cancellationToken);
        return Result.Ok();
    }

    private Task<CommunityUser?> FindAsync(string email, CancellationToken cancellationToken)
    {
        var normalized = email.Trim().ToUpperInvariant();
        return db.Users.SingleOrDefaultAsync(u => u.NormalizedEmail == normalized, cancellationToken);
    }
}
