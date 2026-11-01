namespace FaithTech.Community.Application.Organisations.Platform;

/// <summary>
/// The community app's OAuth client (`web`): every organisation host is one of its redirect URIs, so a member can sign
/// in on that host (accounts-and-memberships design, L2-149 AC5).
/// </summary>
public interface IClientRedirects
{
    /// <summary>Adds <c>{origin}/auth/callback</c> and <c>{origin}/</c> to the client when missing.</summary>
    Task AllowOriginAsync(string origin, CancellationToken cancellationToken = default);
}
