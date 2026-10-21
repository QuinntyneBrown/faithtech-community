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

public class SignInHandler(UserManager<CommunityUser> users, IApplicationDbContext db)
{
    public async Task<SignInResult> HandleAsync(SignInCommand command, CancellationToken cancellationToken = default)
    {
        var user = await users.FindByEmailAsync(command.Email);
        if (user is null)
        {
            return new(null, SignInError.InvalidCredentials);
        }

        if (await users.IsLockedOutAsync(user))
        {
            return new(null, SignInError.LockedOut);
        }

        if (!await users.CheckPasswordAsync(user, command.Password))
        {
            await users.AccessFailedAsync(user);
            return new(null, SignInError.InvalidCredentials);
        }

        // Checked only after a correct password, so a wrong guess cannot learn that an account is suspended.
        if (await db.Profiles.AnyAsync(p => p.Id == user.ProfileId && p.IsSuspended, cancellationToken))
        {
            return new(null, SignInError.Suspended);
        }

        await users.ResetAccessFailedCountAsync(user);
        return new(user, null);
    }
}

public interface ITokenRevocation
{
    /// <summary>Revokes every authorization and token issued to the user.</summary>
    Task RevokeAllAsync(Guid userId, CancellationToken cancellationToken = default);
}
