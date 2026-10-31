using FaithTech.Community.Application.Common;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Organisations;

/// <summary>
/// A role the organisation defines, as the role pickers offer it (L2-136 AC8). Invites still record a pre-assigned
/// role by its <c>Key</c>.
/// </summary>
public sealed record OrganisationRoleDto(Guid Id, string Key, string Name, string Description, bool ChapterScopable);

/// <summary>
/// GET /api/organisation: the names, the chapter label with the active chapters in order (none while chapters are off,
/// L2-140 AC2) and the roles. The taxonomies join it in their slice (organisation-settings design).
/// </summary>
public sealed record OrganisationDto(
    string Name,
    string ShortName,
    ChapterLabelDto? ChapterLabel,
    IReadOnlyList<ChapterOptionDto> Chapters,
    IReadOnlyList<OrganisationRoleDto> Roles);

/// <summary>The host's organisation for any of its members: its names and its roles that are not archived (ADR 0032).</summary>
public class GetOrganisationHandler(IApplicationDbContext db, ICurrentOrganisation organisation)
{
    public async Task<OrganisationDto> HandleAsync(CancellationToken cancellationToken = default)
    {
        var roles = await db.RoleDefinitions
            .Where(d => d.ArchivedAtUtc == null)
            .OrderBy(d => d.SortOrder)
            .ThenBy(d => d.Name)
            .Select(d => new OrganisationRoleDto(d.Id, d.Key, d.Name, d.Description, d.ChapterScopable))
            .ToListAsync(cancellationToken);
        var label = ChapterLabelDto.Of(organisation);
        IReadOnlyList<ChapterOptionDto> chapters = label is null
            ? []
            : await db.Chapters
                .Where(c => c.ArchivedAtUtc == null)
                .OrderBy(c => c.SortOrder)
                .ThenBy(c => c.Name)
                .Select(c => new ChapterOptionDto(c.Id, c.Name))
                .ToListAsync(cancellationToken);
        return new OrganisationDto(organisation.Name, organisation.ShortName, label, chapters, roles);
    }
}
