using FaithTech.Community.Application.Common;
using FluentValidation;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Identity;

public record SignInCommand(string Email, string Password);

public class SignInValidator : AbstractValidator<SignInCommand>
{
    public SignInValidator()
    {
        RuleFor(x => x.Email).NotEmpty().WithMessage("Enter your email address.");
        RuleFor(x => x.Password).NotEmpty().WithMessage("Enter your password.");
    }
}

public enum SignInError
{
    InvalidCredentials,
    LockedOut,
    Suspended,
}

public record SignInResult(CommunityUser? User, SignInError? Error)
{
    public bool Succeeded => User is not null;
}

public class SignInHandler(UserManager<CommunityUser> users, IApplicationDbContext db, TimeProvider time)
{
    public const int MaxFailedAttempts = 5;

    /// <summary>Failures count towards a lockout only within this window, and a lockout lasts this long.</summary>
    public static readonly TimeSpan Window = TimeSpan.FromMinutes(15);

    public async Task<SignInResult> HandleAsync(SignInCommand command, CancellationToken cancellationToken = default)
    {
        var user = await users.FindByEmailAsync(command.Email);
        if (user is null)
        {
            return new(null, SignInError.InvalidCredentials);
        }

        var now = time.GetUtcNow();
        if (user.LockoutEnabled && user.LockoutEnd > now)
        {
            return new(null, SignInError.LockedOut);
        }

        if (!await users.CheckPasswordAsync(user, command.Password))
        {
            await RecordFailureAsync(user, now);
            return new(null, SignInError.InvalidCredentials);
        }

        // Checked only after a correct password, so a wrong guess cannot learn that an account is suspended.
        if (await AccountStatus.IsSuspendedAsync(db, user, cancellationToken))
        {
            return new(null, SignInError.Suspended);
        }

        if (user.AccessFailedCount > 0 || user.FailedAccessWindowStartedAt is not null)
        {
            user.AccessFailedCount = 0;
            user.FailedAccessWindowStartedAt = null;
            await users.UpdateAsync(user);
        }

        return new(user, null);
    }

    // The window is [first failure, first failure + 15 minutes): a failure at or after its end starts a new window.
    // Lockout times use TimeProvider rather than UserManager, whose lockout checks read the system clock.
    private async Task RecordFailureAsync(CommunityUser user, DateTimeOffset now)
    {
        if (user.AccessFailedCount == 0 || user.FailedAccessWindowStartedAt is not { } started || now - started >= Window)
        {
            user.AccessFailedCount = 0;
            user.FailedAccessWindowStartedAt = now;
        }

        user.AccessFailedCount++;
        if (user.AccessFailedCount >= MaxFailedAttempts && user.LockoutEnabled)
        {
            user.LockoutEnd = now + Window;
            user.AccessFailedCount = 0;
            user.FailedAccessWindowStartedAt = null;
        }

        await users.UpdateAsync(user);
    }
}

public interface ITokenRevocation
{
    /// <summary>Revokes every authorization and token issued to the user.</summary>
    Task RevokeAllAsync(Guid userId, CancellationToken cancellationToken = default);
}
