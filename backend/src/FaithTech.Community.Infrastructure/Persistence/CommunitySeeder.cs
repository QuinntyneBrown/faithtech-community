using System.Text.Json;
using FaithTech.Community.Application.Identity;
using FaithTech.Community.Domain.Admin;
using FaithTech.Community.Domain.Events;
using FaithTech.Community.Domain.Organisations;
using FaithTech.Community.Domain.Profiles;
using FaithTech.Community.Domain.Resources;
using FaithTech.Community.Infrastructure.Persistence.Seed;
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

        await SeedOrganisationAsync(cancellationToken);
        await SeedRoleDefinitionsAsync(cancellationToken);
        await SeedPartnerStagesAsync(cancellationToken);
        await SeedEventTypesAsync(cancellationToken);

        // The concurrency token that guards FaithTech's last administrator (LastAdministratorGuard).
        if (!await db.OrganisationAdminRosters.AnyAsync(cancellationToken))
        {
            db.OrganisationAdminRosters.Add(new OrganisationAdminRoster());
            await db.SaveChangesAsync(cancellationToken);
        }

        await SeedStarterResourcesAsync(cancellationToken);
    }

    /// <summary>The FaithTech organisation, found by slug and inserted only when missing, so its later edits survive (L2-151 AC1).</summary>
    private async Task SeedOrganisationAsync(CancellationToken cancellationToken)
    {
        if (!await db.Organisations.AnyAsync(o => o.Slug == FaithTechSeed.Slug, cancellationToken))
        {
            db.Organisations.Add(FaithTechSeed.Organisation());
            await db.SaveChangesAsync(cancellationToken);
        }
    }

    /// <summary>FaithTech's role definitions, found by key and inserted only when missing, so later edits survive (L2-151 AC2).</summary>
    private async Task SeedRoleDefinitionsAsync(CancellationToken cancellationToken)
    {
        var keys = await db.RoleDefinitions.IgnoreQueryFilters()
            .Where(d => d.OrganisationId == FaithTechSeed.OrganisationId)
            .Select(d => d.Key)
            .ToListAsync(cancellationToken);
        var missing = FaithTechSeed.RoleDefinitions().Where(d => !keys.Contains(d.Key)).ToList();
        if (missing.Count > 0)
        {
            db.RoleDefinitions.AddRange(missing);
            await db.SaveChangesAsync(cancellationToken);
        }
    }

    /// <summary>FaithTech's partner stages, found by key and inserted only when missing, so later edits survive (L2-151 AC3).</summary>
    private async Task SeedPartnerStagesAsync(CancellationToken cancellationToken)
    {
        var keys = await db.PartnerStages.IgnoreQueryFilters()
            .Where(s => s.OrganisationId == FaithTechSeed.OrganisationId)
            .Select(s => s.Key)
            .ToListAsync(cancellationToken);
        var missing = FaithTechSeed.PartnerStages().Where(s => !keys.Contains(s.Key)).ToList();
        if (missing.Count > 0)
        {
            db.PartnerStages.AddRange(missing);
            await db.SaveChangesAsync(cancellationToken);
        }
    }

    /// <summary>FaithTech's event types, found by key and inserted only when missing, so later edits survive (L2-151 AC3).</summary>
    private async Task SeedEventTypesAsync(CancellationToken cancellationToken)
    {
        var ids = FaithTechSeed.Types.Select(t => t.Id).ToList();
        var existing = await db.EventTypes.IgnoreQueryFilters()
            .Where(t => t.OrganisationId == FaithTechSeed.OrganisationId || ids.Contains(t.Id))
            .Select(t => new { t.Id, t.Key })
            .ToListAsync(cancellationToken);
        var missing = FaithTechSeed.EventTypes().Where(t => !existing.Any(e => e.Id == t.Id || e.Key == t.Key)).ToList();
        if (missing.Count > 0)
        {
            db.EventTypes.AddRange(missing);
            await db.SaveChangesAsync(cancellationToken);
        }
    }

    /// <summary>The organisation's first active event type, for the load-test events; FaithTech's are seeded first if missing.</summary>
    private async Task<EventType> FirstEventTypeAsync(CancellationToken cancellationToken)
    {
        await SeedEventTypesAsync(cancellationToken);
        return await db.EventTypes.Where(t => t.ArchivedAtUtc == null).OrderBy(t => t.SortOrder).FirstAsync(cancellationToken);
    }

    public record StarterResource(Guid Id, string Title, string Description, ResourceType Type, string Url, string[] Tags);

    /// <summary>Links every member can use from day one (L2-055); fixed ids keep the seed idempotent.</summary>
    public static readonly IReadOnlyList<StarterResource> StarterResources =
    [
        new(new Guid("6f1d1b8e-3c55-4a43-9a41-3f6f0a9d0001"), "FaithTech brand guidelines", "Logos, colours and type for anything that carries the FaithTech name.",
            ResourceType.Logo, "https://faithtech.com/brand", ["brand", "logo"]),
        new(new Guid("6f1d1b8e-3c55-4a43-9a41-3f6f0a9d0002"), "Starting a FaithTech city", "The playbook for launching a new city team.",
            ResourceType.Training, "https://faithtech.com/start-a-city", ["city-team", "launch", "training"]),
        new(new Guid("6f1d1b8e-3c55-4a43-9a41-3f6f0a9d0003"), "Hackathon planning guide", "How to plan, run and follow up a FaithTech hackathon.",
            ResourceType.Document, "https://faithtech.com/hackathons", ["hackathon", "events"]),
    ];

    /// <summary>Adds the starter links once, owned by the first System Admin; until there is one, nothing is added.</summary>
    private async Task SeedStarterResourcesAsync(CancellationToken cancellationToken)
    {
        var owner = await db.Profiles.Where(p => p.Roles.Any(r => r.Definition!.Capabilities.Contains(Capability.AdministerOrganisation))).OrderBy(p => p.Id).Select(p => (Guid?)p.Id)
            .FirstOrDefaultAsync(cancellationToken);
        if (owner is not { } ownerId)
        {
            return;
        }

        var ids = StarterResources.Select(r => r.Id).ToList();
        var existing = await db.Resources.Where(r => ids.Contains(r.Id)).Select(r => r.Id).ToListAsync(cancellationToken);
        var ownerRole = await db.RoleDefinitions.Where(d => d.Capabilities.Contains(Capability.AdministerOrganisation))
            .OrderBy(d => d.SortOrder).Select(d => d.Key).FirstAsync(cancellationToken);
        foreach (var starter in StarterResources.Where(r => !existing.Contains(r.Id)))
        {
            var resource = Resource.ForLink(starter.Title, starter.Description, starter.Type, ownerId, new Uri(starter.Url), time.GetUtcNow(), starter.Id);
            resource.SetOwner(ownerId, ownerRole);
            resource.SetTags(starter.Tags);
            resource.SetAudience(ResourceAudience.Global());
            db.Resources.Add(resource);
        }

        await db.SaveChangesAsync(cancellationToken);
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

            // Join times spread over the last 18 months, so the Reports load test exercises the month chart.
            var profile = new Profile($"Load Tester {i:000}", time.GetUtcNow().UtcDateTime.AddDays(-(i * 540 / count)));
            var user = new CommunityUser
            {
                Id = Guid.NewGuid(),
                UserName = email,
                NormalizedUserName = normalized,
                Email = email,
                NormalizedEmail = normalized,
                EmailConfirmed = true,
                SecurityStamp = Guid.NewGuid().ToString("N"),
            };
            profile.LinkAccount(user.Id);
            user.PasswordHash = hasher.HashPassword(user, password);
            db.Profiles.Add(profile);
            db.Users.Add(user);
            created++;
        }

        await db.SaveChangesAsync(cancellationToken);
        return created;
    }

    /// <summary>The name and title prefix of the records seed-report-records creates, so they are easy to find.</summary>
    public const string ReportRecordPrefix = "Report load ";

    public const int MaxReportMembers = 100_000;

    private static readonly string[] ReportCities = ["Austin", "Calgary", "Halifax", "Toronto", "Vancouver", "Winnipeg"];

    /// <summary>
    /// The Reports volume for the isolated performance environment (L2-129 AC1, eng/load-test.js): verified members
    /// "Report load member 00001" onwards (report-00001@loadtest.invalid, with no password) across six cities, joined
    /// over the last 18 months; one event for every ten members, from 335 days ago to 30 days ahead, every twentieth
    /// cancelled; and 50 member RSVPs on each, 40 of them checked in once the event has started. Idempotent: existing
    /// records are kept. Returns how many members were created.
    /// </summary>
    public async Task<int> SeedReportRecordsAsync(int members, CancellationToken cancellationToken = default)
    {
        var now = time.GetUtcNow();
        var chapters = await ChapterIdsAsync(ReportCities, cancellationToken);
        var type = await FirstEventTypeAsync(cancellationToken);
        var existing = (await db.Profiles.Where(p => p.Name.StartsWith(ReportRecordPrefix)).Select(p => p.Name).ToListAsync(cancellationToken))
            .ToHashSet();
        var created = 0;
        for (var i = 1; i <= members; i++)
        {
            var name = $"{ReportRecordPrefix}member {i:00000}";
            if (existing.Contains(name))
            {
                continue;
            }

            var email = $"report-{i:00000}@{LoadTestDomain}";
            var profile = new Profile(name, now.UtcDateTime.AddDays(-(i * 540L / members)));
            profile.Update(name, chapters[ReportCities[i % ReportCities.Length]], null);
            var user = new CommunityUser
            {
                Id = Guid.NewGuid(),
                UserName = email,
                NormalizedUserName = email.ToUpperInvariant(),
                Email = email,
                NormalizedEmail = email.ToUpperInvariant(),
                EmailConfirmed = true,
                SecurityStamp = Guid.NewGuid().ToString("N"),
            };
            profile.LinkAccount(user.Id);
            db.Profiles.Add(profile);
            db.Users.Add(user);
            created++;
            if (created % 1000 == 0)
            {
                await db.SaveChangesAsync(cancellationToken);
                db.ChangeTracker.Clear();
            }
        }

        await db.SaveChangesAsync(cancellationToken);
        db.ChangeTracker.Clear();

        var titles = (await db.Events.Where(e => e.Title.StartsWith(ReportRecordPrefix)).Select(e => e.Title).ToListAsync(cancellationToken))
            .ToHashSet();
        var events = members / 10;
        for (var i = 1; i <= events; i++)
        {
            var title = $"{ReportRecordPrefix}event {i:00000}";
            if (titles.Contains(title))
            {
                continue;
            }

            var starts = now.AddDays(30 - (i * 365.0 / events));
            var e = new Event(
                title, "A Reports load-test evening.", type, starts, starts.AddHours(2), chapters[ReportCities[i % ReportCities.Length]],
                EventFormat.InPerson, "Load venue", null, null, EventVisibility.MembersOnly, Guid.Empty);
            var rsvps = Enumerable.Range(0, 50).Select(r => e.Rsvp(Guid.NewGuid(), starts.AddDays(-7).AddMinutes(r))).ToList();
            if (starts <= now)
            {
                foreach (var rsvp in rsvps.Take(40))
                {
                    e.CheckIn(rsvp.Id, Guid.Empty, starts);
                }
            }

            if (i % 20 == 0)
            {
                e.Cancel("Load-test cancellation");
            }

            // The tracker is cleared every 100 events; the type stays an existing row.
            db.EventTypes.Attach(type);
            db.Events.Add(e);
            if (i % 100 == 0)
            {
                await db.SaveChangesAsync(cancellationToken);
                db.ChangeTracker.Clear();
            }
        }

        await db.SaveChangesAsync(cancellationToken);
        return created;
    }

    /// <summary>The ids of the chapters with these names, adding at the end of the list any the organisation lacks.</summary>
    private async Task<Dictionary<string, Guid>> ChapterIdsAsync(IEnumerable<string> names, CancellationToken cancellationToken)
    {
        var active = await db.Chapters.Where(c => c.ArchivedAtUtc == null).ToListAsync(cancellationToken);
        var ids = new Dictionary<string, Guid>(StringComparer.Ordinal);
        foreach (var name in names)
        {
            var chapter = active.FirstOrDefault(c => c.NormalizedName == Chapter.Normalize(name));
            if (chapter is null)
            {
                chapter = new Chapter(name, active.Count);
                active.Add(chapter);
                db.Chapters.Add(chapter);
            }

            ids[name] = chapter.Id;
        }

        await db.SaveChangesAsync(cancellationToken);
        return ids;
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
        var chapters = await ChapterIdsAsync(Enumerable.Range(0, 50).Select(i => $"City {i:00}"), cancellationToken);
        var type = await FirstEventTypeAsync(cancellationToken);
        var created = 0;
        for (var i = 1; i <= count; i++)
        {
            var title = $"{SearchRecordPrefix}{i:000000}";
            if (existing.Contains(title))
            {
                continue;
            }

            var words = $"{SearchWords[i % SearchWords.Length]} {SearchWords[i / SearchWords.Length % SearchWords.Length]}";
            db.EventTypes.Attach(type);
            db.Events.Add(new Event(
                title, $"A {words} evening.", type, starts, starts.AddHours(2), chapters[$"City {i % 50:00}"],
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
        var profileId = await db.Users.Where(u => u.NormalizedEmail == normalized)
            .Join(db.Profiles, u => (Guid?)u.Id, p => p.UserId, (u, p) => (Guid?)p.Id).SingleOrDefaultAsync(cancellationToken);
        if (profileId is null)
        {
            return false;
        }

        var profile = await db.Profiles.SingleAsync(p => p.Id == profileId, cancellationToken);
        if (profile.Roles.Any(r => r.Definition?.Carries(Capability.AdministerOrganisation) == true))
        {
            return true;
        }

        // The organisation's first role carrying AdministerOrganisation (System Admin in FaithTech's seed), seeded first if
        // the database has not been seeded yet.
        await SeedRoleDefinitionsAsync(cancellationToken);
        var administrator = (await db.RoleDefinitions.Where(d => d.ArchivedAtUtc == null).OrderBy(d => d.SortOrder).ToListAsync(cancellationToken))
            .First(d => d.Carries(Capability.AdministerOrganisation));
        var before = profile.Roles.Select(r => r.Definition!.Key).Order().ToArray();
        var now = time.GetUtcNow().UtcDateTime;
        profile.AddRole(administrator, Guid.Empty, now);
        var after = profile.Roles.Select(r => r.Definition!.Key).Order().ToArray();
        db.AuditEntries.Add(new AuditEntry(
            Guid.Empty, "role.granted", "Profile", profile.Id.ToString(),
            JsonSerializer.Serialize(new { Roles = before }), JsonSerializer.Serialize(new { Roles = after }), now, "cli"));
        await db.SaveChangesAsync(cancellationToken);
        return true;
    }
}
