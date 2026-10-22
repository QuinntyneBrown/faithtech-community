using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Contacts;
using FaithTech.Community.Application.Profiles;
using FaithTech.Community.Domain.Identity;
using FaithTech.Community.Domain.Profiles;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Identity;

/// <summary>What a validated Google ID token says about the person (ADR 0019).</summary>
public record GoogleIdentity(string Subject, string Email, bool EmailVerified, string? Name);

/// <summary>Google's OpenID Connect provider; Infrastructure talks to Google, tests use a fake.</summary>
public interface IGoogleIdentityProvider
{
    /// <summary>The URL that sends the browser to Google, or null when Google sign-in is not configured.</summary>
    string? BuildAuthorizationUrl(string state, string nonce, string redirectUri);

    /// <summary>
    /// Exchanges the authorization code and validates the ID token (signature, issuer, audience, expiry and
    /// <paramref name="nonce"/>). Null when the code or the token is not valid.
    /// </summary>
    Task<GoogleIdentity?> ExchangeCodeAsync(string code, string redirectUri, string nonce, CancellationToken cancellationToken = default);
}

public record GoogleSignInCommand(string Code, string RedirectUri, string Nonce);

public enum GoogleSignInError
{
    InvalidToken,
    UnverifiedEmail,
    Suspended,
}

public record GoogleSignInResult(CommunityUser? User, GoogleSignInError? Error)
{
    public bool Succeeded => User is not null;
}

/// <summary>
/// Signs in, links or creates an account from a Google identity (L2-078, ADR 0019). A Google login is linked only
/// to an account whose email Google has verified; a new account has no role, a verified email and no password.
/// </summary>
public class GoogleSignInHandler(
    UserManager<CommunityUser> users,
    IApplicationDbContext db,
    IGoogleIdentityProvider google,
    ContactSignedUpHandler contactSignedUp)
{
    public const string LoginProvider = "Google";

    public async Task<GoogleSignInResult> HandleAsync(GoogleSignInCommand command, CancellationToken cancellationToken = default)
    {
        var identity = await google.ExchangeCodeAsync(command.Code, command.RedirectUri, command.Nonce, cancellationToken);
        if (identity is null)
        {
            return new(null, GoogleSignInError.InvalidToken);
        }

        // Only an address Google has verified proves who the person is; nothing is created or linked otherwise.
        if (!identity.EmailVerified)
        {
            return new(null, GoogleSignInError.UnverifiedEmail);
        }

        var user = await users.FindByLoginAsync(LoginProvider, identity.Subject)
            ?? await LinkByEmailAsync(identity, cancellationToken)
            ?? await CreateAsync(identity, cancellationToken);

        // The same rule and outcome as password sign-in, reported only now the person has proven who they are.
        return await AccountStatus.IsSuspendedAsync(db, user, cancellationToken)
            ? new(null, GoogleSignInError.Suspended)
            : new(user, null);
    }

    private async Task<CommunityUser?> LinkByEmailAsync(GoogleIdentity identity, CancellationToken cancellationToken)
    {
        var user = await users.FindByEmailAsync(identity.Email);
        if (user is null)
        {
            return null;
        }

        Ensure(await users.AddLoginAsync(user, new UserLoginInfo(LoginProvider, identity.Subject, "Google")));
        if (!user.EmailConfirmed)
        {
            // Nobody proved they own this address until now, so whoever chose the password cannot keep it.
            user.EmailConfirmed = true;
            if (await users.HasPasswordAsync(user))
            {
                Ensure(await users.RemovePasswordAsync(user));
            }

            Ensure(await users.UpdateAsync(user));
            await contactSignedUp.HandleAsync(new EmailVerified(user.ProfileId, user.Email!), cancellationToken);
        }

        return user;
    }

    private async Task<CommunityUser> CreateAsync(GoogleIdentity identity, CancellationToken cancellationToken)
    {
        var profile = new Profile(ProfileName(identity));
        db.Profiles.Add(profile);
        var user = new CommunityUser { UserName = identity.Email, Email = identity.Email, EmailConfirmed = true, ProfileId = profile.Id };

        // The user store shares the context, so the profile and the account commit together. No role is granted.
        Ensure(await users.CreateAsync(user));
        Ensure(await users.AddLoginAsync(user, new UserLoginInfo(LoginProvider, identity.Subject, "Google")));
        await contactSignedUp.HandleAsync(new EmailVerified(user.ProfileId, user.Email!), cancellationToken);
        return user;
    }

    /// <summary>Google's name, held to the profile editor's limit, or the email's local part when Google gives none.</summary>
    private static string ProfileName(GoogleIdentity identity)
    {
        var name = string.IsNullOrWhiteSpace(identity.Name) ? identity.Email.Split('@')[0] : identity.Name.Trim();
        return name.Length <= UpdateProfileValidator.MaxName ? name : name[..UpdateProfileValidator.MaxName].TrimEnd();
    }

    private static void Ensure(IdentityResult result)
    {
        if (!result.Succeeded)
        {
            throw new InvalidOperationException($"Google sign-in failed: {string.Join(", ", result.Errors.Select(e => e.Code))}");
        }
    }
}

/// <summary>Account rules every way of signing in shares.</summary>
public static class AccountStatus
{
    public static Task<bool> IsSuspendedAsync(IApplicationDbContext db, CommunityUser user, CancellationToken cancellationToken = default) =>
        db.Profiles.AnyAsync(p => p.Id == user.ProfileId && p.IsSuspended, cancellationToken);
}
