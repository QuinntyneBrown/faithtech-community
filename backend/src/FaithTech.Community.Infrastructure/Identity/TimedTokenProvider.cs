using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;

namespace FaithTech.Community.Infrastructure.Identity;

/// <summary>
/// Data-protected, single-purpose token whose age is measured with <see cref="TimeProvider"/>. Tokens are bound to
/// the user's security stamp, so they stop working once the stamp changes.
/// </summary>
public class TimedTokenProvider<TUser>(IDataProtectionProvider dataProtection, TimeProvider time, string name, TimeSpan lifetime)
    : IUserTwoFactorTokenProvider<TUser>
    where TUser : class
{
    private readonly IDataProtector _protector = dataProtection.CreateProtector("FaithTech.Community.Tokens", name);

    public async Task<string> GenerateAsync(string purpose, UserManager<TUser> manager, TUser user)
    {
        using var stream = new MemoryStream();
        await using (var writer = new BinaryWriter(stream, Encoding.UTF8, leaveOpen: true))
        {
            writer.Write(time.GetUtcNow().UtcTicks);
            writer.Write(await manager.GetUserIdAsync(user));
            writer.Write(purpose);
            writer.Write(await manager.GetSecurityStampAsync(user) ?? string.Empty);
        }

        return Convert.ToBase64String(_protector.Protect(stream.ToArray()));
    }

    public async Task<bool> ValidateAsync(string purpose, string token, UserManager<TUser> manager, TUser user)
    {
        try
        {
            using var reader = new BinaryReader(new MemoryStream(_protector.Unprotect(Convert.FromBase64String(token))));
            var created = new DateTimeOffset(reader.ReadInt64(), TimeSpan.Zero);
            return created + lifetime >= time.GetUtcNow()
                && reader.ReadString() == await manager.GetUserIdAsync(user)
                && reader.ReadString() == purpose
                && reader.ReadString() == (await manager.GetSecurityStampAsync(user) ?? string.Empty);
        }
        catch (Exception exception) when (exception is FormatException or CryptographicException or EndOfStreamException)
        {
            return false;
        }
    }

    public Task<bool> CanGenerateTwoFactorTokenAsync(UserManager<TUser> manager, TUser user) => Task.FromResult(false);
}

public class EmailConfirmationTokenProvider<TUser>(IDataProtectionProvider dataProtection, TimeProvider time)
    : TimedTokenProvider<TUser>(dataProtection, time, Name, TimeSpan.FromHours(24))
    where TUser : class
{
    public const string Name = "EmailConfirmation";
}

public class PasswordResetTokenProvider<TUser>(IDataProtectionProvider dataProtection, TimeProvider time)
    : TimedTokenProvider<TUser>(dataProtection, time, Name, TimeSpan.FromHours(1))
    where TUser : class
{
    public const string Name = "PasswordReset";
}
