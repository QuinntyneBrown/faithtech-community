using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Resources;

/// <summary>A member a resource can be shared with or handed to: name, roles and city (L2-061 AC1, L2-064 AC3).</summary>
public record ResourceMemberDto(Guid Id, string Name, string? City, IReadOnlyList<string> Roles);

/// <summary>
/// The people picker for sharing (contributors only) and the new-owner picker for a transfer (System Admin only,
/// listing only members who can own resources). Suspended members are never offered.
/// </summary>
public class ResourceMembersHandler(IApplicationDbContext db, ResourceAccess access)
{
    public const int Limit = 10;

    public async Task<IReadOnlyList<ResourceMemberDto>?> ShareCandidatesAsync(string? q, CancellationToken cancellationToken = default) =>
        access.CanContribute ? await FindAsync(q, ownersOnly: false, cancellationToken) : null;

    public async Task<IReadOnlyList<ResourceMemberDto>?> OwnerCandidatesAsync(string? q, CancellationToken cancellationToken = default) =>
        access.IsSystemAdmin ? await FindAsync(q, ownersOnly: true, cancellationToken) : null;

    private async Task<IReadOnlyList<ResourceMemberDto>> FindAsync(string? q, bool ownersOnly, CancellationToken cancellationToken)
    {
        var members = from user in db.Users.AsNoTracking()
                      join profile in db.Profiles.AsNoTracking() on (Guid?)user.Id equals profile.UserId
                      where !profile.IsSuspended
                      select profile;
        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim().ToLower();
            members = members.Where(p => p.Name.ToLower().Contains(term));
        }

        if (ownersOnly)
        {
            var roles = LegacyRoles.Keys(ResourceAccess.ContributorRoles);
            members = members.Where(p => p.Roles.Any(r => roles.Contains(r.Definition!.Key)));
        }

        var rows = await members.OrderBy(p => p.Name).ThenBy(p => p.Id).Take(Limit)
            .Select(p => new { p.Id, p.Name, p.HomeCity, Roles = p.Roles.OrderBy(r => r.Definition!.SortOrder).Select(r => r.Definition!.Key).ToList() })
            .ToListAsync(cancellationToken);
        return [.. rows.Select(r => new ResourceMemberDto(r.Id, r.Name, r.HomeCity, [.. r.Roles.Order().Select(x => x.ToString())]))];
    }
}
