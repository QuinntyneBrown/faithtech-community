using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Profiles;
using FaithTech.Community.Domain.Profiles;
using FaithTech.Community.Domain.Team;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Team;

public enum TeamRoleFilter
{
    Leads,
    Volunteers,
}

/// <summary>Optional filters; the city is a filter on home city, never a permission boundary (ADR 0007).</summary>
public record ListTeamQuery(TeamRoleFilter? Role = null, string? City = null);

/// <summary>Derives the team from current roles on every request, so role changes show at once (L2-019).</summary>
public class ListTeamHandler(IApplicationDbContext db, IPhotoStorage storage)
{
    public async Task<TeamListDto> HandleAsync(ListTeamQuery query, CancellationToken cancellationToken = default)
    {
        var teamRoles = TeamRoles.All.ToList();
        var team = await db.Profiles.AsNoTracking()
            .Where(p => p.Roles.Any(r => teamRoles.Contains(r.Role)))
            .ToListAsync(cancellationToken);

        var city = query.City?.Trim();
        var members = team
            .Where(p => query.Role switch
            {
                TeamRoleFilter.Leads => p.Roles.Any(r => TeamRoles.Leads.Contains(r.Role)),
                TeamRoleFilter.Volunteers => p.HasRole(Domain.Profiles.Role.Volunteer),
                _ => true,
            })
            .Where(p => string.IsNullOrEmpty(city) || string.Equals(p.HomeCity?.Trim(), city, StringComparison.OrdinalIgnoreCase))
            .OrderBy(p => p.Name, StringComparer.OrdinalIgnoreCase)
            .Select(ToDto)
            .ToList();
        var cities = team
            .Select(p => p.HomeCity?.Trim())
            .OfType<string>()
            .Where(c => c.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Order(StringComparer.OrdinalIgnoreCase)
            .ToList();
        return new TeamListDto(members, cities);
    }

    private TeamMemberDto ToDto(Profile profile) => new(
        profile.Id,
        profile.Name,
        profile.HomeCity,
        profile.Photos.FirstOrDefault(p => p.IsFeatured) is { } featured ? storage.GetReadUrl(featured.BlobName) : null,
        [.. profile.Roles.OrderBy(r => r.Role).Select(r => r.Role.ToString())]);
}
