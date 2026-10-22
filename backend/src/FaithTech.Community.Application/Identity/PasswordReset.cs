using FaithTech.Community.Application.Common;
using FluentValidation;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;

namespace FaithTech.Community.Application.Identity;

public record RequestPasswordResetCommand(string Email);

public class RequestPasswordResetValidator : AbstractValidator<RequestPasswordResetCommand>
{
    public RequestPasswordResetValidator()
    {
        RuleFor(x => x.Email).Cascade(CascadeMode.Stop)
            .NotEmpty().WithMessage("Enter your email address.")
            .EmailAddress().WithMessage("Enter an email address like name@example.com.")
            .MaximumLength(256);
    }
}

public class RequestPasswordResetHandler(
    UserManager<CommunityUser> users, IEmailSender email, IApplicationDbContext db, IOptions<WebAppOptions> webApp)
{
    public async Task<Result> HandleAsync(RequestPasswordResetCommand command, CancellationToken cancellationToken = default)
    {
        // Same result whether or not the account exists; only existing accounts get an email.
        var user = await users.FindByEmailAsync(command.Email);
        if (user is null)
        {
            return Result.Ok();
        }

        var token = await users.GeneratePasswordResetTokenAsync(user);
        var link = $"{webApp.Value.Origin}/reset-password?userId={user.Id}&token={Uri.EscapeDataString(token)}";
        await email.SendAsync(new EmailMessage(
            user.Email!,
            "Reset your FaithTech Community password",
            $"Choose a new password for your account:\n\n{link}\n\nThis link expires in 1 hour. If you did not ask for it, you can ignore this email."),
            cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        return Result.Ok();
    }
}

public record ResetPasswordCommand(Guid UserId, string Token, string Password);

public class ResetPasswordValidator : AbstractValidator<ResetPasswordCommand>
{
    public ResetPasswordValidator(IBreachedPasswordChecker breachedPasswords)
    {
        RuleFor(x => x.UserId).NotEmpty();
        RuleFor(x => x.Token).NotEmpty();
        RuleFor(x => x.Password).CommunityPassword(breachedPasswords);
    }
}

public class ResetPasswordHandler(UserManager<CommunityUser> users, ITokenRevocation revocation)
{
    public const string InvalidLinkMessage = "This link has expired or has already been used.";

    public async Task<Result> HandleAsync(ResetPasswordCommand command, CancellationToken cancellationToken = default)
    {
        var user = await users.FindByIdAsync(command.UserId.ToString());

        // Resetting changes the security stamp, which also makes the link single-use.
        if (user is null || !(await users.ResetPasswordAsync(user, command.Token, command.Password)).Succeeded)
        {
            return Result.Invalid("Token", InvalidLinkMessage);
        }

        await users.ResetAccessFailedCountAsync(user);
        await users.SetLockoutEndDateAsync(user, null);
        await revocation.RevokeAllAsync(user.Id, cancellationToken);
        return Result.Ok();
    }
}
