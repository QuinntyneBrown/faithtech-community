using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Admin;

public enum UserStatus
{
    Active,
    Suspended,
    Unverified,
}

/// <summary>One account on the admin users page (L2-040 AC1). <see cref="Id"/> is the profile id.</summary>
public record AdminUserSummary(Guid Id, string Name, string Email, IReadOnlyList<string> Roles, string Status);

/// <summary>Searches every account by name or email; System Admin only.</summary>
public class SearchUsersHandler(IApplicationDbContext db, ICurrentUser current)
{
    public const int PageSize = 25;

    public async Task<PagedResult<AdminUserSummary>?> HandleAsync(string? term, int page, CancellationToken cancellationToken = default)
    {
        if (!current.HasRole(Role.SystemAdmin))
        {
            return null;
        }

        var accounts = from user in db.Users.AsNoTracking()
                       join profile in db.Profiles.AsNoTracking() on user.ProfileId equals profile.Id
                       select new { user, profile };
        if (!string.IsNullOrWhiteSpace(term))
        {
            var lowered = term.Trim().ToLower();
            accounts = accounts.Where(a => a.profile.Name.ToLower().Contains(lowered) || a.user.Email!.ToLower().Contains(lowered));
        }

        var request = new PageRequest(page, PageSize);
        var total = await accounts.CountAsync(cancellationToken);
        var rows = await accounts
            .OrderBy(a => a.profile.Name).ThenBy(a => a.profile.Id)
            .Skip(request.Skip).Take(request.PageSize)
            .Select(a => new
            {
                a.profile.Id,
                a.profile.Name,
                a.user.Email,
                Roles = a.profile.Roles.Select(r => r.Role).ToList(),
                a.profile.IsSuspended,
                a.user.EmailConfirmed,
            })
            .ToListAsync(cancellationToken);

        var items = rows.Select(r => new AdminUserSummary(
            r.Id,
            r.Name,
            r.Email ?? string.Empty,
            [.. r.Roles.Order().Select(role => role.ToString())],
            (r.IsSuspended ? UserStatus.Suspended : r.EmailConfirmed ? UserStatus.Active : UserStatus.Unverified).ToString())).ToList();
        return new PagedResult<AdminUserSummary>(items, request.Page, request.PageSize, total);
    }
}
