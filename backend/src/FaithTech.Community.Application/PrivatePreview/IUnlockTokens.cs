namespace FaithTech.Community.Application.PrivatePreview;

/// <summary>Signed, tamper-proof unlock tokens that carry their own expiry (L2-104).</summary>
public interface IUnlockTokens
{
    string Issue(DateTimeOffset expiresAt);

    /// <summary>False for an expired, tampered, malformed or foreign-key token.</summary>
    bool IsValid(string? token);
}
