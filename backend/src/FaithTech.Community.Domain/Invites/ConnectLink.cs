using FaithTech.Community.Domain.Organisations;

namespace FaithTech.Community.Domain.Invites;

/// <summary>
/// A City Lead's reusable connect link, shown as a QR code (ADR 0021). Unlike an invite it is not single-use
/// and never expires; replacing the token retires the old link.
/// </summary>
public class ConnectLink : IOrganisationScoped
{
    /// <summary>The organisation the record belongs to, stamped when it is saved (ADR 0032).</summary>
    public Guid OrganisationId { get; private set; }

    private ConnectLink() { }

    public ConnectLink(Guid ownerId, string tokenHash, string protectedToken, DateTimeOffset issuedAt)
    {
        Id = Guid.NewGuid();
        OwnerId = ownerId;
        Replace(tokenHash, protectedToken, issuedAt);
    }

    public Guid Id { get; private set; }

    public Guid OwnerId { get; private set; }

    /// <summary>SHA-256 of the token, for lookups.</summary>
    public string TokenHash { get; private set; } = string.Empty;

    /// <summary>The token encrypted with Data Protection, so only the owner can be shown it again.</summary>
    public string ProtectedToken { get; private set; } = string.Empty;

    public DateTimeOffset IssuedAt { get; private set; }

    public void Replace(string tokenHash, string protectedToken, DateTimeOffset now)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(tokenHash);
        ArgumentException.ThrowIfNullOrWhiteSpace(protectedToken);
        TokenHash = tokenHash;
        ProtectedToken = protectedToken;
        IssuedAt = now;
    }
}
