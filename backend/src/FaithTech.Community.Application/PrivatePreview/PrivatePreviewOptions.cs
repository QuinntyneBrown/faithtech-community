namespace FaithTech.Community.Application.PrivatePreview;

/// <summary>The private-preview wall (ADR 0026); secrets come from configuration or Key Vault, never the repository.</summary>
public class PrivatePreviewOptions
{
    public const string Section = "PrivatePreview";

    /// <summary>On unless configuration turns it off; only appsettings.Development.json does (L2-107).</summary>
    public bool Enabled { get; set; } = true;

    /// <summary>The owner's passphrase as <c>pbkdf2-sha256$iterations$salt$hash</c>, made by the Cli's <c>wall-hash</c>.</summary>
    public string PassphraseHash { get; set; } = string.Empty;

    /// <summary>Base64 HMAC key for unlock tokens; replacing it revokes every unlock (L2-105).</summary>
    public string SigningKey { get; set; } = string.Empty;

    /// <summary>Parent domain shared by www and app, so one unlock covers both; empty for a host-only cookie.</summary>
    public string? CookieDomain { get; set; }

    public TimeSpan UnlockLifetime { get; set; } = TimeSpan.FromDays(7);
}
