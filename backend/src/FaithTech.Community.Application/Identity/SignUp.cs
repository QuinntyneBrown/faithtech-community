using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Profiles;
using FluentValidation;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;

namespace FaithTech.Community.Application.Identity;

public record SignUpCommand(string Name, string Email, string Password);

public class SignUpValidator : AbstractValidator<SignUpCommand>
{
    public SignUpValidator(IBreachedPasswordChecker breachedPasswords)
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("Enter your name.").MaximumLength(200);
        RuleFor(x => x.Email).Cascade(CascadeMode.Stop)
            .NotEmpty().WithMessage("Enter your email address.")
            .EmailAddress().WithMessage("Enter an email address like name@example.com.")
            .MaximumLength(256);
        RuleFor(x => x.Password).CommunityPassword(breachedPasswords);
    }
}

public class SignUpHandler(
    UserManager<CommunityUser> users,
    IApplicationDbContext db,
    VerificationEmails verificationEmails)
{
    public async Task<Result> HandleAsync(SignUpCommand command, CancellationToken cancellationToken = default)
    {
        // Same outcome whether or not the email is registered, so the form discloses nothing.
        if (await users.FindByEmailAsync(command.Email) is not null)
        {
            return Result.Ok();
        }

        var profile = new Profile(command.Name.Trim());
        db.Profiles.Add(profile);
        var user = new CommunityUser { UserName = command.Email, Email = command.Email, ProfileId = profile.Id };

        // The user store shares the context, so the profile and the account commit together.
        var created = await users.CreateAsync(user, command.Password);
        if (!created.Succeeded)
        {
            if (created.Errors.Any(e => e.Code is nameof(IdentityErrorDescriber.DuplicateEmail) or nameof(IdentityErrorDescriber.DuplicateUserName)))
            {
                return Result.Ok();
            }

            throw new InvalidOperationException($"Account creation failed: {string.Join(", ", created.Errors.Select(e => e.Code))}");
        }

        await verificationEmails.SendAsync(user, cancellationToken);
        return Result.Ok();
    }
}

public class VerificationEmails(UserManager<CommunityUser> users, IEmailSender email, IOptions<WebAppOptions> webApp)
{
    public async Task SendAsync(CommunityUser user, CancellationToken cancellationToken = default)
    {
        var token = await users.GenerateEmailConfirmationTokenAsync(user);
        var link = $"{webApp.Value.Origin}/verify-email?userId={user.Id}&token={Uri.EscapeDataString(token)}";
        await email.SendAsync(new EmailMessage(
            user.Email!,
            "Verify your FaithTech Community email",
            $"Confirm your email address to finish setting up your account:\n\n{link}\n\nThis link expires in 24 hours."),
            cancellationToken);
    }
}
