using FluentValidation;

namespace FaithTech.Community.Application.Identity;

public static class PasswordRules
{
    public const int MinimumLength = 12;

    public static IRuleBuilderOptions<T, string> CommunityPassword<T>(
        this IRuleBuilderInitial<T, string> rule, IBreachedPasswordChecker breachedPasswords) =>
        rule.Cascade(CascadeMode.Stop)
            .NotEmpty().WithMessage("Enter a password.")
            .MinimumLength(MinimumLength).WithMessage($"Use at least {MinimumLength} characters.")
            .MustAsync(async (password, ct) => !await breachedPasswords.IsBreachedAsync(password, ct))
            .WithMessage("This password has appeared in a data breach. Choose a different one.");
}
