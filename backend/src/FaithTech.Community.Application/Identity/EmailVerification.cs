using FaithTech.Community.Application.Common;
using FluentValidation;
using Microsoft.AspNetCore.Identity;

namespace FaithTech.Community.Application.Identity;

public record ConfirmEmailCommand(Guid UserId, string Token);

public class ConfirmEmailValidator : AbstractValidator<ConfirmEmailCommand>
{
    public ConfirmEmailValidator()
    {
        RuleFor(x => x.UserId).NotEmpty();
        RuleFor(x => x.Token).NotEmpty();
    }
}

public class ConfirmEmailHandler(UserManager<CommunityUser> users)
{
    public const string InvalidLinkMessage = "This link has expired or has already been used.";

    public async Task<Result> HandleAsync(ConfirmEmailCommand command)
    {
        var user = await users.FindByIdAsync(command.UserId.ToString());

        // A confirmed email means the link was already used; unknown users look the same as bad tokens.
        if (user is null || user.EmailConfirmed || !(await users.ConfirmEmailAsync(user, command.Token)).Succeeded)
        {
            return Result.Invalid("Token", InvalidLinkMessage);
        }

        return Result.Ok();
    }
}

public interface IVerificationResendLog
{
    Task<int> CountSinceAsync(string normalizedEmail, DateTimeOffset since, CancellationToken cancellationToken = default);

    Task RecordAsync(string normalizedEmail, DateTimeOffset at, CancellationToken cancellationToken = default);
}

public record ResendVerificationCommand(string Email);

public class ResendVerificationValidator : AbstractValidator<ResendVerificationCommand>
{
    public ResendVerificationValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(256);
    }
}

public class ResendVerificationHandler(
    UserManager<CommunityUser> users,
    IVerificationResendLog log,
    VerificationEmails verificationEmails,
    TimeProvider time)
{
    public const int MaxResendsPerHour = 3;

    /// <summary>Returns false when the resend limit is reached.</summary>
    public async Task<bool> HandleAsync(ResendVerificationCommand command, CancellationToken cancellationToken = default)
    {
        // Count by email whether or not an account exists, so the limit reveals nothing.
        var normalizedEmail = users.NormalizeEmail(command.Email);
        var now = time.GetUtcNow();
        if (await log.CountSinceAsync(normalizedEmail, now.AddHours(-1), cancellationToken) >= MaxResendsPerHour)
        {
            return false;
        }

        await log.RecordAsync(normalizedEmail, now, cancellationToken);

        var user = await users.FindByEmailAsync(command.Email);
        if (user is { EmailConfirmed: false })
        {
            await verificationEmails.SendAsync(user, cancellationToken);
        }

        return true;
    }
}
