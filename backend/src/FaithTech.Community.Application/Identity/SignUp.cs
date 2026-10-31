using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Organisations;
using FaithTech.Community.Application.Profiles;
using FaithTech.Community.Domain.Profiles;
using FluentValidation;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Identity;

public record SignUpCommand(string Name, string Email, string Password);

public class SignUpValidator : AbstractValidator<SignUpCommand>
{
    public SignUpValidator(IBreachedPasswordChecker breachedPasswords)
    {
        RuleFor(x => x.Name).CommunityName();
        RuleFor(x => x.Email).CommunityEmail();
        RuleFor(x => x.Password).CommunityPassword(breachedPasswords);
    }
}

/// <summary>The L2-001 name and email rules, shared by every form that creates an account.</summary>
public static class SignUpRules
{
    // The same limit as the profile editor, so a new member can always save their name unchanged.
    public static IRuleBuilderOptions<T, string> CommunityName<T>(this IRuleBuilderInitial<T, string> rule) =>
        rule.Cascade(CascadeMode.Stop)
            .Must(name => !string.IsNullOrWhiteSpace(name)).WithMessage("Enter your name.")
            .Must(name => name.Trim().Length <= UpdateProfileValidator.MaxName)
            .WithMessage($"Use {UpdateProfileValidator.MaxName} characters or fewer for your name.");

    public static IRuleBuilderOptions<T, string> CommunityEmail<T>(this IRuleBuilderInitial<T, string> rule) =>
        rule.Cascade(CascadeMode.Stop)
            .NotEmpty().WithMessage("Enter your email address.")
            .EmailAddress().WithMessage("Enter an email address like name@example.com.")
            .MaximumLength(256);
}

public class SignUpHandler(
    UserManager<CommunityUser> users,
    IApplicationDbContext db,
    VerificationEmails verificationEmails,
    TimeProvider time)
{
    public async Task<Result> HandleAsync(SignUpCommand command, CancellationToken cancellationToken = default)
    {
        await CreateAsync(command, cancellationToken);
        return Result.Ok();
    }

    /// <summary>
    /// Creates the account and sends the verification email; null when the email is already registered. An existing
    /// account with no profile in this organisation is sent a verification email that, once confirmed, makes it a
    /// member here under the submitted name (L2-132 AC1). Callers answer the same either way, so the form discloses
    /// nothing (L2-001 AC2).
    /// </summary>
    public async Task<CommunityUser?> CreateAsync(SignUpCommand command, CancellationToken cancellationToken = default)
    {
        if (await users.FindByEmailAsync(command.Email) is { } existing)
        {
            // The profile query is filtered to this organisation, so a profile elsewhere does not count.
            if (!await db.Profiles.AnyAsync(p => p.UserId == existing.Id, cancellationToken))
            {
                await verificationEmails.SendAsync(existing, joinAs: command.Name.Trim(), cancellationToken);
            }
            return null;
        }

        var profile = new Profile(command.Name.Trim(), time.GetUtcNow().UtcDateTime);
        db.Profiles.Add(profile);
        var user = new CommunityUser { Id = Guid.NewGuid(), UserName = command.Email, Email = command.Email };
        profile.LinkAccount(user.Id);

        // The user store shares the context, so the profile and the account commit together.
        var created = await users.CreateAsync(user, command.Password);
        if (!created.Succeeded)
        {
            if (created.Errors.Any(e => e.Code is nameof(IdentityErrorDescriber.DuplicateEmail) or nameof(IdentityErrorDescriber.DuplicateUserName)))
            {
                return null;
            }

            throw new InvalidOperationException($"Account creation failed: {string.Join(", ", created.Errors.Select(e => e.Code))}");
        }

        await verificationEmails.SendAsync(user, cancellationToken);
        return user;
    }
}

public class VerificationEmails(UserManager<CommunityUser> users, IEmailSender email, ICurrentOrganisation organisation)
{
    public Task SendAsync(CommunityUser user, CancellationToken cancellationToken = default) =>
        SendAsync(user, joinAs: null, cancellationToken);

    /// <summary>
    /// Sends the verification link on this organisation's host. With <paramref name="joinAs"/>, the link also carries
    /// the name and a join token bound to this organisation and that name, so confirming it creates the profile here
    /// and a changed name is refused (L2-132 AC1).
    /// </summary>
    public async Task SendAsync(CommunityUser user, string? joinAs, CancellationToken cancellationToken = default)
    {
        var token = await users.GenerateEmailConfirmationTokenAsync(user);
        var link = $"{organisation.Origin}/verify-email?userId={user.Id}&token={Uri.EscapeDataString(token)}";
        if (joinAs is not null)
        {
            var join = await users.GenerateUserTokenAsync(user, users.Options.Tokens.EmailConfirmationTokenProvider, JoinPurpose(organisation.Id, joinAs));
            link += $"&name={Uri.EscapeDataString(joinAs)}&join={Uri.EscapeDataString(join)}";
        }

        await email.SendAsync(new EmailMessage(
            user.Email!,
            $"Verify your {organisation.Name} email",
            $"Confirm your email address to finish setting up your account:\n\n{link}\n\nThis link expires in 24 hours."),
            cancellationToken);
    }

    /// <summary>What a join token vouches for: this account joining this organisation under this name.</summary>
    public static string JoinPurpose(Guid organisationId, string name) => $"JoinOrganisation:{organisationId}:{name}";
}
