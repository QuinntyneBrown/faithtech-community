using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Organisations;
using FluentValidation;
using Microsoft.AspNetCore.Identity;

namespace FaithTech.Community.Application.Identity;

/// <summary>The caller's account as Settings shows it. An account made with Google may have no password yet.</summary>
public record AccountDto(string Email, bool HasPassword);

/// <summary>
/// The Account card's save (L2-052): the email to sign in with, and a new password with the current one. An unchanged
/// email and an empty new password change nothing.
/// </summary>
public record UpdateAccountCommand(string Email, string? CurrentPassword = null, string? NewPassword = null);

/// <summary>What a save did: the address a verification link went to, and whether the password changed.</summary>
public record AccountUpdated(string? PendingEmail, bool PasswordChanged);

/// <summary>The email-change link: the account, the new address and the change-email token for it.</summary>
public record ConfirmEmailChangeCommand(Guid UserId, string Email, string Token);

public class UpdateAccountValidator : AbstractValidator<UpdateAccountCommand>
{
    public UpdateAccountValidator(IBreachedPasswordChecker breachedPasswords)
    {
        RuleFor(x => x.Email).Cascade(CascadeMode.Stop)
            .NotEmpty().WithMessage("Enter your email address.")
            .EmailAddress().WithMessage("Enter an email address like name@example.com.")
            .MaximumLength(256).WithMessage("Use 256 characters or fewer for your email.");
        When(x => !string.IsNullOrEmpty(x.NewPassword), () =>
            RuleFor(x => x.NewPassword!).CommunityPassword(breachedPasswords));
    }
}

public class ConfirmEmailChangeValidator : AbstractValidator<ConfirmEmailChangeCommand>
{
    public ConfirmEmailChangeValidator()
    {
        RuleFor(x => x.UserId).NotEmpty();
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Token).NotEmpty();
    }
}

/// <summary>
/// A member's own account (L2-052). The account is global (ADR 0032), so every change applies on every organisation
/// host; the verification email goes out in the name of the organisation whose host received the change (L2-134 AC5).
/// </summary>
public class AccountSettingsHandler(
    UserManager<CommunityUser> users, ICurrentUser current, IEmailSender email, ICurrentOrganisation organisation, ITokenRevocation revocation)
{
    public const string InvalidLinkMessage = "This link has expired or has already been used.";

    public async Task<AccountDto?> GetAsync()
    {
        var user = await CallerAsync();
        return user is null ? null : new AccountDto(user.Email!, await users.HasPasswordAsync(user));
    }

    public async Task<(Result Result, AccountUpdated? Updated)> UpdateAsync(UpdateAccountCommand command, CancellationToken cancellationToken = default)
    {
        if (await CallerAsync() is not { } user)
        {
            return (Result.Forbidden(), null);
        }

        var newEmail = command.Email.Trim();
        var changesEmail = !string.Equals(users.NormalizeEmail(newEmail), user.NormalizedEmail, StringComparison.Ordinal);
        if (changesEmail && await users.FindByEmailAsync(newEmail) is not null)
        {
            return (Result.Invalid(nameof(command.Email), "Another account uses that email."), null);
        }

        var passwordChanged = false;
        if (!string.IsNullOrEmpty(command.NewPassword))
        {
            var hasPassword = await users.HasPasswordAsync(user);
            if (hasPassword && string.IsNullOrEmpty(command.CurrentPassword))
            {
                return (Result.Invalid(nameof(command.CurrentPassword), "Enter your current password to change it."), null);
            }

            var changed = hasPassword
                ? await users.ChangePasswordAsync(user, command.CurrentPassword!, command.NewPassword)
                : await users.AddPasswordAsync(user, command.NewPassword);
            if (!changed.Succeeded)
            {
                return (Result.Invalid(nameof(command.CurrentPassword), "Your current password is incorrect."), null);
            }

            passwordChanged = true;
        }

        if (changesEmail)
        {
            // The sign-in email changes only when the link sent to the new address is opened (L2-052 AC1).
            var token = await users.GenerateChangeEmailTokenAsync(user, newEmail);
            var link = $"{organisation.Origin}/verify-email?userId={user.Id}&email={Uri.EscapeDataString(newEmail)}&token={Uri.EscapeDataString(token)}";
            await email.SendAsync(new EmailMessage(
                newEmail,
                $"Confirm your new {organisation.Name} email",
                $"You asked to sign in to {organisation.Name} with this address. Confirm it to make the change:\n\n{link}\n\n" +
                "Until you do, you keep signing in with your current email. If you did not ask for this, you can ignore this email."),
                cancellationToken);
        }

        return (Result.Ok(), new AccountUpdated(changesEmail ? newEmail : null, passwordChanged));
    }

    public async Task<Result> ConfirmEmailChangeAsync(ConfirmEmailChangeCommand command)
    {
        var user = await users.FindByIdAsync(command.UserId.ToString());
        if (user is null || !(await users.ChangeEmailAsync(user, command.Email, command.Token)).Succeeded)
        {
            return Result.Invalid("Token", InvalidLinkMessage);
        }

        // The user name is the email, so the new address is the one to sign in with.
        await users.SetUserNameAsync(user, command.Email);
        return Result.Ok();
    }

    /// <summary>Ends every session and refresh token of the account, on every organisation host (L2-052 AC3).</summary>
    public async Task<Result> SignOutEverywhereAsync(CancellationToken cancellationToken = default)
    {
        if (current.UserId is not { } userId)
        {
            return Result.Forbidden();
        }

        await revocation.RevokeAllAsync(userId, cancellationToken);
        return Result.Ok();
    }

    private async Task<CommunityUser?> CallerAsync() =>
        current.UserId is { } id ? await users.FindByIdAsync(id.ToString()) : null;
}
