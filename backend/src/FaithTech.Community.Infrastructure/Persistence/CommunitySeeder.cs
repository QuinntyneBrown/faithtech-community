using System.Text.Json;
using FaithTech.Community.Application.Identity;
using FaithTech.Community.Domain.Admin;
using FaithTech.Community.Domain.Events;
using FaithTech.Community.Domain.Profiles;
using Microsoft.AspNetCore.Identity;
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

        // The concurrency token that guards the last System Admin (ChangeRolesHandler).
        if (!await db.SystemAdminRosters.AnyAsync(r => r.Id == SystemAdminRoster.SingletonId, cancellationToken))
        {
            db.SystemAdminRosters.Add(new SystemAdminRoster());
            await db.SaveChangesAsync(cancellationToken);
        }
    }

    public const int MaxLoadTestUsers = 1000;

    /// <summary>A reserved top-level domain (RFC 2606): mail to it can never reach a real person.</summary>
    public const string LoadTestDomain = "loadtest.invalid";

    /// <summary>
    /// Creates verified members load-001@loadtest.invalid onwards, with no role, for the isolated
    /// performance environment (eng/load-test.js). Idempotent: existing load-test members are kept.
    /// Returns how many were created.
    /// </summary>
    public async Task<int> SeedLoadTestUsersAsync(int count, string password, CancellationToken cancellationToken = default)
    {
        var hasher = new PasswordHasher<CommunityUser>();
        var created = 0;
        for (var i = 1; i <= count; i++)
        {
            var email = $"load-{i:000}@{LoadTestDomain}";
            var normalized = email.ToUpperInvariant();
            if (await db.Users.AnyAsync(u => u.NormalizedEmail == normalized, cancellationToken))
            {
                continue;
            }

            var profile = new Profile($"Load Tester {i:000}");
            var user = new CommunityUser
            {
                Id = Guid.NewGuid(),
                UserName = email,
                NormalizedUserName = normalized,
                Email = email,
                NormalizedEmail = normalized,
                EmailConfirmed = true,
                SecurityStamp = Guid.NewGuid().ToString("N"),
                ProfileId = profile.Id,
            };
            user.PasswordHash = hasher.HashPassword(user, password);
            db.Profiles.Add(profile);
            db.Users.Add(user);
            created++;
        }

        await db.SaveChangesAsync(cancellationToken);
        return created;
    }

    public const int MaxSearchRecords = 1_000_000;

    /// <summary>The title prefix of the events seed-search-records creates, so they are easy to find and remove.</summary>
    public const string SearchRecordPrefix = "Load search event ";

    private static readonly string[] SearchWords =
        ["shelter", "hackathon", "builders", "prayer", "planning", "mentoring", "students", "design", "data", "health"];

    /// <summary>
    /// Creates members-only events "Load search event 000001" onwards with varied words, so the performance
    /// environment holds 100,000 indexed records for the search load test (L2-026 AC5, eng/load-test.js).
    /// Idempotent: existing ones are kept. Returns how many were created.
    /// </summary>
    public async Task<int> SeedSearchRecordsAsync(int count, CancellationToken cancellationToken = default)
    {
        var existing = (await db.Events.Where(e => e.Title.StartsWith(SearchRecordPrefix)).Select(e => e.Title).ToListAsync(cancellationToken))
            .ToHashSet();
        var starts = time.GetUtcNow().AddDays(30);
        var created = 0;
        for (var i = 1; i <= count; i++)
        {
            var title = $"{SearchRecordPrefix}{i:000000}";
            if (existing.Contains(title))
            {
                continue;
            }

            var words = $"{SearchWords[i % SearchWords.Length]} {SearchWords[i / SearchWords.Length % SearchWords.Length]}";
            db.Events.Add(new Event(
                title, $"A {words} evening.", EventType.Gathering, starts, starts.AddHours(2), $"City {i % 50:00}",
                EventFormat.InPerson, "Load venue", null, null, EventVisibility.MembersOnly, Guid.Empty));
            created++;
            if (created % 1000 == 0)
            {
                await db.SaveChangesAsync(cancellationToken);
                db.ChangeTracker.Clear();
            }
        }

        await db.SaveChangesAsync(cancellationToken);
        return created;
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
