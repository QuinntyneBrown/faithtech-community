using FaithTech.Community.Application.Common;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Organisations;

/// <summary>A role the organisation defines, as the role pickers offer it (L2-136 AC8).</summary>
public sealed record OrganisationRoleDto(Guid Id, string Name, string Description, bool ChapterScopable);

/// <summary>
/// GET /api/organisation. Chapters and the taxonomies join it in their slices (organisation-settings design).
/// </summary>
public sealed record OrganisationDto(string Name, string ShortName, ChapterLabelDto? ChapterLabel, IReadOnlyList<OrganisationRoleDto> Roles);

/// <summary>The host's organisation for any of its members: its names and its roles that are not archived (ADR 0032).</summary>
public class GetOrganisationHandler(IApplicationDbContext db, ICurrentOrganisation organisation)
{
    public async Task<OrganisationDto> HandleAsync(CancellationToken cancellationToken = default)
    {
        var roles = await db.RoleDefinitions
            .Where(d => d.ArchivedAtUtc == null)
            .OrderBy(d => d.SortOrder)
            .ThenBy(d => d.Name)
            .Select(d => new OrganisationRoleDto(d.Id, d.Name, d.Description, d.ChapterScopable))
            .ToListAsync(cancellationToken);
        return new OrganisationDto(organisation.Name, organisation.ShortName, ChapterLabelDto.Of(organisation), roles);
    }
}
