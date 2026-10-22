using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Profiles;
using FaithTech.Community.Domain.Resources;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Resources;

/// <summary>A row of the Resources list (L2-055 AC2, AC3).</summary>
public record ResourceSummaryDto(
    Guid Id,
    string Title,
    string Type,
    string? FileName,
    string? Extension,
    long? Size,
    string? LinkUrl,
    string? LinkHost,
    Guid OwnerId,
    string OwnerName,
    bool IsOwn,
    string Visibility,
    bool SharedWithYou,
    bool HasThumbnail,
    bool IsStored,
    DateTimeOffset AddedAt);

public record AudienceMemberDto(Guid Id, string Name, string? City);

/// <summary>A role in the audience, with how many members hold it today (L2-056 AC4).</summary>
public record AudienceRoleDto(string Role, int Count);

public record AudienceDto(IReadOnlyList<AudienceMemberDto> Members, IReadOnlyList<AudienceRoleDto> Roles);

/// <summary>
/// The resource page (L2-056). <c>SharedVia</c> is "you" or the role a Shared resource reached the viewer through;
/// <c>OwnerLostRole</c> is the contributing role the owner no longer holds, shown to System Admin (L2-064 AC2).
/// </summary>
public record ResourceDto(
    Guid Id,
    string Title,
    string? Description,
    string Type,
    IReadOnlyList<string> Tags,
    string? FileName,
    string? Extension,
    long? Size,
    string? LinkUrl,
    string? LinkHost,
    Guid OwnerId,
    string OwnerName,
    bool IsOwn,
    string Visibility,
    bool SharedWithYou,
    string? SharedVia,
    AudienceDto Audience,
    bool HasThumbnail,
    bool IsStored,
    DateTimeOffset AddedAt,
    DateTimeOffset? UpdatedAt,
    string? UpdatedByName,
    DateTimeOffset? FileReplacedAt,
    string? FileReplacedByName,
    DateTimeOffset? ArchivedAt,
    DateTimeOffset? PurgeAt,
    bool CanEdit,
    bool CanTransfer,
    string? OwnerLostRole);

public record ResourceTagDto(string Name, int Count);

/// <summary>Builds the resource DTOs as the caller sees them.</summary>
public class ResourceViews(IApplicationDbContext db, ICurrentUser current, ResourceAccess access)
{
    public async Task<ResourceDto> DetailAsync(Resource r, Guid caller, CancellationToken cancellationToken = default)
    {
        var people = new[] { r.OwnerId, r.UpdatedById, r.FileReplacedById }.OfType<Guid>().Concat(r.SharedMembers.Select(m => m.ProfileId)).Distinct().ToList();
        var profiles = await db.Profiles.AsNoTracking().Where(p => people.Contains(p.Id))
            .Select(p => new { p.Id, p.Name, p.HomeCity, Roles = p.Roles.Select(x => x.Role).ToList() })
            .ToDictionaryAsync(p => p.Id, cancellationToken);
        var roles = r.SharedRoles.Select(x => x.Role).ToList();
        var roleCounts = new List<AudienceRoleDto>();
        foreach (var role in ResourceAccess.ShareableRoles.Where(roles.Contains))
        {
            var count = await db.Profiles.CountAsync(p => !p.IsSuspended && p.Roles.Any(x => x.Role == role), cancellationToken);
            roleCounts.Add(new AudienceRoleDto(role.ToString(), count));
        }

        var owner = profiles.GetValueOrDefault(r.OwnerId);
        var ownerContributes = owner is not null && owner.Roles.Any(ResourceAccess.ContributorRoles.Contains);
        var isOwn = r.OwnerId == caller;
        var sharedVia = SharedVia(r, caller, isOwn);
        string? Name(Guid? id) => id is { } x && profiles.TryGetValue(x, out var p) ? p.Name : null;
        return new ResourceDto(
            r.Id,
            r.Title,
            r.Description,
            r.Type.ToString(),
            [.. r.Tags.Select(t => t.Tag)],
            r.File?.FileName,
            r.File?.Extension,
            r.File?.Size,
            r.LinkUrl,
            r.LinkHost,
            r.OwnerId,
            owner?.Name ?? "A former member",
            isOwn,
            r.Visibility.ToString(),
            sharedVia is not null,
            sharedVia,
            new AudienceDto(
                [.. r.SharedMembers.Where(m => profiles.ContainsKey(m.ProfileId)).Select(m => profiles[m.ProfileId])
                    .Select(p => new AudienceMemberDto(p.Id, p.Name, p.HomeCity)).OrderBy(m => m.Name)],
                roleCounts),
            r.File?.ThumbnailBlobName is not null,
            r.File?.IsStored ?? true,
            r.AddedAt,
            r.UpdatedAt,
            Name(r.UpdatedById),
            r.FileReplacedAt,
            Name(r.FileReplacedById),
            r.ArchivedAt,
            r.PurgeAt,
            access.CanChange(r, caller),
            access.IsSystemAdmin,
            ownerContributes ? null : r.OwnerRole?.ToString());
    }

    /// <summary>The list rows, newest first, with owner names in one query.</summary>
    public async Task<IReadOnlyList<ResourceSummaryDto>> SummariesAsync(IQueryable<Resource> resources, Guid caller, CancellationToken cancellationToken = default)
    {
        var roles = current.Roles.ToList();
        var rows = await resources
            .Select(r => new
            {
                r.Id,
                r.Title,
                r.Type,
                FileName = r.File == null ? null : r.File.FileName,
                Extension = r.File == null ? null : r.File.Extension,
                Size = r.File == null ? (long?)null : r.File.Size,
                r.LinkUrl,
                r.LinkHost,
                r.OwnerId,
                OwnerName = db.Profiles.Where(p => p.Id == r.OwnerId).Select(p => p.Name).FirstOrDefault(),
                r.Visibility,
                SharedWithYou = r.Visibility == ResourceVisibility.Shared && r.OwnerId != caller
                    && (r.SharedMembers.Any(m => m.ProfileId == caller) || r.SharedRoles.Any(x => roles.Contains(x.Role))),
                HasThumbnail = r.File != null && r.File.ThumbnailBlobName != null,
                IsStored = r.File == null || r.File.IsStored,
                r.AddedAt,
            })
            .ToListAsync(cancellationToken);
        return [.. rows.Select(r => new ResourceSummaryDto(
            r.Id, r.Title, r.Type.ToString(), r.FileName, r.Extension, r.Size, r.LinkUrl, r.LinkHost, r.OwnerId,
            r.OwnerName ?? "A former member", r.OwnerId == caller, r.Visibility.ToString(), r.SharedWithYou, r.HasThumbnail, r.IsStored, r.AddedAt))];
    }

    private string? SharedVia(Resource r, Guid caller, bool isOwn)
    {
        if (isOwn || r.Visibility != ResourceVisibility.Shared)
        {
            return null;
        }

        if (r.SharedMembers.Any(m => m.ProfileId == caller))
        {
            return "you";
        }

        return r.SharedRoles.Select(x => x.Role).Where(current.HasRole).Select(x => (Role?)x).FirstOrDefault()?.ToString();
    }
}
