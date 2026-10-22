using System.Security.Cryptography;
using System.Text;
using FaithTech.Community.Application.PrivatePreview;

namespace FaithTech.Community.Infrastructure.PrivatePreview;

/// <summary>PBKDF2-HMAC-SHA256, encoded <c>pbkdf2-sha256$iterations$salt$hash</c> in base64 (ADR 0023).</summary>
public class Pbkdf2PassphraseHasher : IPassphraseHasher
{
    public const int Iterations = 600_000;

    private const string Prefix = "pbkdf2-sha256";
    private const int SaltBytes = 16;
    private const int HashBytes = 32;

    public string Hash(string passphrase)
    {
        var salt = RandomNumberGenerator.GetBytes(SaltBytes);
        var hash = Rfc2898DeriveBytes.Pbkdf2(Encoding.UTF8.GetBytes(passphrase), salt, Iterations, HashAlgorithmName.SHA256, HashBytes);
        return $"{Prefix}${Iterations}${Convert.ToBase64String(salt)}${Convert.ToBase64String(hash)}";
    }

    public bool Verify(string passphrase, string encodedHash)
    {
        if (!TryParse(encodedHash, out var iterations, out var salt, out var expected))
        {
            throw new InvalidOperationException("The passphrase hash is not a usable PBKDF2 hash.");
        }

        var actual = Rfc2898DeriveBytes.Pbkdf2(Encoding.UTF8.GetBytes(passphrase), salt, iterations, HashAlgorithmName.SHA256, expected.Length);
        return CryptographicOperations.FixedTimeEquals(actual, expected);
    }

    public bool IsUsable(string encodedHash) => TryParse(encodedHash, out _, out _, out _);

    private static bool TryParse(string? encoded, out int iterations, out byte[] salt, out byte[] hash)
    {
        iterations = 0;
        salt = hash = [];
        var parts = encoded?.Split('$') ?? [];
        try
        {
            if (parts.Length != 4 || parts[0] != Prefix || !int.TryParse(parts[1], out iterations) || iterations < Iterations)
            {
                return false;
            }

            salt = Convert.FromBase64String(parts[2]);
            hash = Convert.FromBase64String(parts[3]);
            return salt.Length >= SaltBytes && hash.Length >= HashBytes;
        }
        catch (FormatException)
        {
            return false;
        }
    }
}
