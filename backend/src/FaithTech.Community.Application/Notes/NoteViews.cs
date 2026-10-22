using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Notes;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Notes;

/// <summary>Builds the note DTOs as the caller sees them.</summary>
public class NoteViews(IApplicationDbContext db, ICurrentUser current, NoteAccess access, NoteRefs refs)
{
    public const string FormerMember = "A former member";

    public async Task<NotePageDto> DetailAsync(NotePage page, Guid caller, CancellationToken cancellationToken = default)
    {
        var people = new[] { page.OwnerId, page.UpdatedById }.Concat(page.SharedMembers.Select(m => m.ProfileId)).Distinct().ToList();
        var profiles = await db.Profiles.AsNoTracking().Where(p => people.Contains(p.Id))
            .Select(p => new { p.Id, p.Name, p.HomeCity })
            .ToDictionaryAsync(p => p.Id, cancellationToken);
        var roleCounts = new List<NoteAudienceRoleDto>();
        foreach (var role in NoteAccess.ShareableRoles.Where(r => page.SharedRoles.Any(x => x.Role == r)))
        {
            var count = await db.Profiles.CountAsync(p => !p.IsSuspended && p.Roles.Any(x => x.Role == role), cancellationToken);
            roleCounts.Add(new NoteAudienceRoleDto(role.ToString(), count));
        }

        var blocks = NoteContent.Read(page.Content);
        var links = await refs.VisibleAsync([.. NoteRefs.LinkedIds(blocks)], caller, cancellationToken);
        var isOwn = page.OwnerId == caller;
        var sharedVia = SharedVia(page, caller, isOwn);
        string Name(Guid id) => profiles.TryGetValue(id, out var p) ? p.Name : FormerMember;
        return new NotePageDto(
            page.Id,
            page.Title,
            page.Icon,
            page.ParentId,
            page.OwnerId,
            Name(page.OwnerId),
            isOwn,
            page.Visibility.ToString(),
            sharedVia is not null,
            sharedVia,
            new NoteAudienceDto(
                [.. page.SharedMembers.Where(m => profiles.ContainsKey(m.ProfileId)).Select(m => profiles[m.ProfileId])
                    .Select(p => new NoteAudienceMemberDto(p.Id, p.Name, p.HomeCity)).OrderBy(m => m.Name)],
                roleCounts),
            NoteRefs.Resolve(blocks, links),
            page.Version,
            page.CreatedAt,
            page.UpdatedAt,
            Name(page.UpdatedById),
            page.ArchivedAt,
            access.CanChange(page, caller),
            access.IsOverride(page, caller),
            await refs.BreadcrumbAsync(page, caller, cancellationToken),
            await refs.ChildrenAsync(page.Id, caller, cancellationToken),
            await refs.BacklinksAsync(page.Id, caller, cancellationToken),
            [.. links.Values]);
    }

    /// <summary>The list rows with owner and editor names in one query.</summary>
    public async Task<IReadOnlyList<NotePageSummaryDto>> SummariesAsync(IQueryable<NotePage> pages, Guid caller, CancellationToken cancellationToken = default)
    {
        var roles = current.Roles.ToList();
        var rows = await pages
            .Select(p => new
            {
                p.Id,
                p.Title,
                p.Icon,
                p.OwnerId,
                Owner = db.Profiles.Where(x => x.Id == p.OwnerId).Select(x => x.Name).FirstOrDefault(),
                p.Visibility,
                SharedWithCaller = p.SharedMembers.Any(m => m.ProfileId == caller) || p.SharedRoles.Any(x => roles.Contains(x.Role)),
                p.UpdatedAt,
                Editor = db.Profiles.Where(x => x.Id == p.UpdatedById).Select(x => x.Name).FirstOrDefault(),
                p.ParentId,
            })
            .ToListAsync(cancellationToken);
        var parents = await refs.VisibleAsync([.. rows.Where(r => r.ParentId is not null).Select(r => r.ParentId!.Value).Distinct()], caller, cancellationToken);
        return [.. rows.Select(r => new NotePageSummaryDto(
            r.Id,
            r.Title,
            r.Icon,
            r.OwnerId,
            r.Owner ?? FormerMember,
            r.OwnerId == caller,
            r.Visibility.ToString(),
            r.OwnerId != caller && r.Visibility == NoteVisibility.Shared && r.SharedWithCaller,
            r.UpdatedAt,
            r.Editor ?? FormerMember,
            r.ParentId is { } parent ? parents.GetValueOrDefault(parent)?.Title ?? NoteRefs.PrivatePage : null))];
    }

    private string? SharedVia(NotePage page, Guid caller, bool isOwn)
    {
        if (isOwn || page.Visibility != NoteVisibility.Shared)
        {
            return null;
        }

        if (page.SharedMembers.Any(m => m.ProfileId == caller))
        {
            return "you";
        }

        return page.SharedRoles.Select(x => x.Role).Where(current.HasRole).Select(x => (Role?)x).FirstOrDefault()?.ToString();
    }
}
