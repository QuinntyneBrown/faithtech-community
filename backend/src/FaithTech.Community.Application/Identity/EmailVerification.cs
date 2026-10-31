using FaithTech.Community.Domain.Profiles;
using FaithTech.Community.Application.Organisations;
using Microsoft.EntityFrameworkCore;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Contacts;
using FaithTech.Community.Domain.Identity;
using FluentValidation;
using Microsoft.AspNetCore.Identity;

namespace FaithTech.Community.Application.Identity;

/// <summary>Name and Join are set on a link that also makes an existing account a member of this organisation (L2-132 AC1).</summary>
public record ConfirmEmailCommand(Guid UserId, string Token, string? Name = null, string? Join = null);

public class ConfirmEmailValidator : AbstractValidator<ConfirmEmailCommand>
{
    public ConfirmEmailValidator()
    {
        RuleFor(x => x.UserId).NotEmpty();
        RuleFor(x => x.Token).NotEmpty();
    }
}

public class ConfirmEmailHandler(
    UserManager<CommunityUser> users,
    IApplicationDbContext db,
    ContactSignedUpHandler contactSignedUp,
    ICurrentOrganisation organisation,
    TimeProvider time)
{
    public const string InvalidLinkMessage = "This link has expired or has already been used.";

    public async Task<Result> HandleAsync(ConfirmEmailCommand command)
    {
        var user = await users.FindByIdAsync(command.UserId.ToString());
        if (command.Join is not null)
        {
            return await JoinAsync(user, command);
        }

        // A confirmed email means the link was already used; unknown users look the same as bad tokens.
        if (user is null || user.EmailConfirmed || !(await users.ConfirmEmailAsync(user, command.Token)).Succeeded)
        {
            return Result.Invalid("Token", InvalidLinkMessage);
        }

        // Only a verified email is matched against private contacts (L2-015 AC3).
        // Matched for the membership being verified: the account's profile in this organisation (ADR 0032).
        if (await db.Profiles.Where(p => p.UserId == user.Id).Select(p => (Guid?)p.Id).SingleOrDefaultAsync() is { } profileId)
        {
            await contactSignedUp.HandleAsync(new EmailVerified(profileId, user.Email!));
        }
        return Result.Ok();
    }

    // An existing account confirming a sign-up on this host: the email is confirmed if it was not, and the account
    // gains a profile here under the name the join token vouches for. A used link finds the profile and is refused.
    private async Task<Result> JoinAsync(CommunityUser? user, ConfirmEmailCommand command)
    {
        var name = command.Name?.Trim() ?? string.Empty;
        if (user is null
            || name.Length == 0
            || await db.Profiles.AnyAsync(p => p.UserId == user.Id)
            || !await users.VerifyUserTokenAsync(user, users.Options.Tokens.EmailConfirmationTokenProvider, VerificationEmails.JoinPurpose(organisation.Id, name), command.Join!)
            || !(await users.ConfirmEmailAsync(user, command.Token)).Succeeded)
        {
            return Result.Invalid("Token", InvalidLinkMessage);
        }

        var profile = new Profile(name, time.GetUtcNow().UtcDateTime);
        profile.LinkAccount(user.Id);
        db.Profiles.Add(profile);
        await db.SaveChangesAsync();
        await contactSignedUp.HandleAsync(new EmailVerified(profile.Id, user.Email!));
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
