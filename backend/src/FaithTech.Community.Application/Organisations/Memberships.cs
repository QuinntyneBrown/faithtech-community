using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Organisations;

/// <summary>Makes an account a member of the current organisation, for the routes that may (L2-132 AC2, ADR 0032).</summary>
public class Memberships(IApplicationDbContext db, TimeProvider time)
{
    /// <summary>
    /// The account's profile here, added (not saved) when it has none, under the name of its newest other profile: the
    /// account holds no name of its own.
    /// </summary>
    public async Task<Profile> JoinAsync(Guid userId, string fallbackName, CancellationToken cancellationToken = default)
    {
        if (await db.Profiles.SingleOrDefaultAsync(p => p.UserId == userId, cancellationToken) is { } existing)
        {
            return existing;
        }

        var name = await db.Profiles.IgnoreQueryFilters(QueryFilters.OrganisationOnly)
            .Where(p => p.UserId == userId)
            .OrderByDescending(p => p.JoinedAtUtc)
            .Select(p => p.Name)
            .FirstOrDefaultAsync(cancellationToken);
        var profile = new Profile(name ?? fallbackName, time.GetUtcNow().UtcDateTime);
        profile.LinkAccount(userId);
        db.Profiles.Add(profile);
        return profile;
    }
}
