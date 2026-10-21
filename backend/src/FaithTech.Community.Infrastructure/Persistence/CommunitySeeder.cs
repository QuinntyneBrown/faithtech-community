using System.Text.Json;
using FaithTech.Community.Domain.Admin;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;
using OpenIddict.Abstractions;
using static OpenIddict.Abstractions.OpenIddictConstants;

namespace FaithTech.Community.Infrastructure.Persistence;

/// <summary>Idempotent seed data: safe to run on every deployment.</summary>
public class CommunitySeeder(IOpenIddictApplicationManager applications, CommunityDbContext db, TimeProvider time)
{
    public const string WebClientId = "web";

    public async Task SeedAsync(string webAppOrigin, CancellationToken cancellationToken = default)
    {
        var descriptor = new OpenIddictApplicationDescriptor
        {
            ClientId = WebClientId,
            ClientType = ClientTypes.Public,
            ConsentType = ConsentTypes.Implicit,
            DisplayName = "FaithTech Community web app",
            RedirectUris = { new Uri($"{webAppOrigin}/auth/callback") },
            PostLogoutRedirectUris = { new Uri($"{webAppOrigin}/") },
            Permissions =
            {
                Permissions.Endpoints.Authorization,
                Permissions.Endpoints.Token,
                Permissions.Endpoints.Revocation,
                Permissions.Endpoints.EndSession,
                Permissions.GrantTypes.AuthorizationCode,
                Permissions.GrantTypes.RefreshToken,
                Permissions.ResponseTypes.Code,
                Permissions.Scopes.Email,
                Permissions.Scopes.Profile,
                Permissions.Scopes.Roles,
                Permissions.Prefixes.Scope + Scopes.OfflineAccess,
            },
            Requirements = { Requirements.Features.ProofKeyForCodeExchange },
        };

        var existing = await applications.FindByClientIdAsync(WebClientId, cancellationToken);
        if (existing is null)
        {
            await applications.CreateAsync(descriptor, cancellationToken);
        }
        else
        {
            await applications.UpdateAsync(existing, descriptor, cancellationToken);
        }
    }

    /// <summary>
    /// Makes an existing account a System Admin, so a new deployment has its first administrator (L2-009 AC6).
    /// Idempotent; the grant is audited with the command line as its source. Returns false for an unknown email.
    /// </summary>
    public async Task<bool> GrantSystemAdminAsync(string email, CancellationToken cancellationToken = default)
    {
        var normalized = email.Trim().ToUpperInvariant();
        var profileId = await db.Users.Where(u => u.NormalizedEmail == normalized).Select(u => (Guid?)u.ProfileId).SingleOrDefaultAsync(cancellationToken);
        if (profileId is null)
        {
            return false;
        }

        var profile = await db.Profiles.SingleAsync(p => p.Id == profileId, cancellationToken);
        if (profile.HasRole(Role.SystemAdmin))
        {
            return true;
        }

        var before = profile.Roles.Select(r => r.Role.ToString()).Order().ToArray();
        var now = time.GetUtcNow().UtcDateTime;
        profile.AddRole(Role.SystemAdmin, Guid.Empty, now);
        var after = profile.Roles.Select(r => r.Role.ToString()).Order().ToArray();
        db.AuditEntries.Add(new AuditEntry(
            Guid.Empty, "role.granted", "Profile", profile.Id.ToString(),
            JsonSerializer.Serialize(new { Roles = before }), JsonSerializer.Serialize(new { Roles = after }), now, "cli"));
        await db.SaveChangesAsync(cancellationToken);
        return true;
    }
}
