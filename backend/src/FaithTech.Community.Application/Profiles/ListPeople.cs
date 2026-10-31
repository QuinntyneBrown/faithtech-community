using FaithTech.Community.Domain.Organisations;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Profiles;

/// <summary>A member as the people directory lists them (L2-053). The email is matched, never returned.</summary>
public record PersonSummary(Guid Id, string Name, string? ChapterName, string? PhotoUrl, IReadOnlyList<ProfileRoleDto> Roles);

/// <summary>
/// The people directory for City Leads, Staff and System Admins (L2-053). Not the System Admin users search:
/// it returns no email or account status, so a City Lead gains no administrative data.
/// </summary>
public class ListPeopleHandler(IApplicationDbContext db, ICurrentUser current, IPhotoStorage storage)
{
    public const int PageSize = 25;

    public bool CanBrowse => current.Has(Capability.ViewPeopleDirectory);

    /// <summary>
    /// A page of members by name, narrowed to a home chapter when one is given (L2-142 AC2; ignored while chapters are
    /// off or for an id the organisation does not have), or null when the caller may not browse people.
    /// </summary>
    public async Task<PagedResult<PersonSummary>?> HandleAsync(string? term, int page, Guid? chapterId = null, CancellationToken cancellationToken = default)
    {
        if (!CanBrowse)
        {
            return null;
        }

        var people = from user in db.Users.AsNoTracking()
                     join profile in db.Profiles.AsNoTracking() on (Guid?)user.Id equals profile.UserId
                     select new { user, profile };
        if (!string.IsNullOrWhiteSpace(term))
        {
            var lowered = term.Trim().ToLower();
            people = people.Where(a => a.profile.Name.ToLower().Contains(lowered) || a.user.Email!.ToLower().Contains(lowered));
        }

        // The chapter query filter hides every chapter while chapters are off, so the filter then lapses.
        if (chapterId is { } id && await db.Chapters.AnyAsync(c => c.Id == id, cancellationToken))
        {
            people = people.Where(a => a.profile.ChapterId == id);
        }

        var request = new PageRequest(page, PageSize);
        var total = await people.CountAsync(cancellationToken);
        var rows = await people
            .OrderBy(a => a.profile.Name).ThenBy(a => a.profile.Id)
            .Skip(request.Skip).Take(request.PageSize)
            .Select(a => new
            {
                a.profile.Id,
                a.profile.Name,
                ChapterName = a.profile.Chapter == null ? null : a.profile.Chapter.Name,
                Featured = a.profile.Photos.Where(p => p.IsFeatured).Select(p => p.BlobName).FirstOrDefault(),
                Roles = a.profile.Roles.OrderBy(r => r.Definition!.SortOrder).ThenBy(r => r.Chapter!.Name)
                    .Select(r => new ProfileRoleDto(r.RoleDefinitionId, r.Definition!.Name, r.ChapterId, r.Chapter!.Name)).ToList(),
            })
            .ToListAsync(cancellationToken);

        var items = rows.Select(r => new PersonSummary(
            r.Id,
            r.Name,
            r.ChapterName,
            r.Featured is null ? null : storage.GetReadUrl(r.Featured),
            r.Roles)).ToList();
        return new PagedResult<PersonSummary>(items, request.Page, request.PageSize, total);
    }
}
