using FaithTech.Community.Application.Admin;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Resources;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Resources;

/// <summary>An archived resource as the Archived page lists it (L2-063 AC3).</summary>
public record ArchivedResourceDto(
    Guid Id, string Title, string Type, string TypeName, string? Extension, long? Size, string? LinkHost, DateTimeOffset ArchivedAt, DateTimeOffset PurgeAt);

/// <summary>
/// Archive and restore (L2-063): the owner or a System Admin, the admin's action audited. An archived resource is
/// hidden from everyone else, so restoring one you cannot see is not found.
/// </summary>
public class ArchiveResourceHandler(IApplicationDbContext db, ResourceAccess access, IAuditLog audit, TimeProvider time)
{
    public Task<Result> ArchiveAsync(Guid id, CancellationToken cancellationToken = default) =>
        ChangeAsync(id, archive: true, cancellationToken);

    public Task<Result> RestoreAsync(Guid id, CancellationToken cancellationToken = default) =>
        ChangeAsync(id, archive: false, cancellationToken);

    /// <summary>The caller's own archived resources, newest first.</summary>
    public async Task<IReadOnlyList<ArchivedResourceDto>> ListAsync(CancellationToken cancellationToken = default)
    {
        var caller = await access.CallerAsync(cancellationToken);
        var rows = await db.Resources.AsNoTracking()
            .Where(r => r.OwnerId == caller && r.ArchivedAt != null)
            .OrderByDescending(r => r.ArchivedAt)
            .Select(r => new
            {
                r.Id, r.Title, TypeKey = r.Type!.Key, TypeName = r.Type.Name, Extension = r.File == null ? null : r.File.Extension, Size = r.File == null ? (long?)null : r.File.Size, r.LinkHost, r.ArchivedAt,
            })
            .ToListAsync(cancellationToken);
        return [.. rows.Select(r => new ArchivedResourceDto(
            r.Id, r.Title, r.TypeKey, r.TypeName, r.Extension, r.Size, r.LinkHost, r.ArchivedAt!.Value, r.ArchivedAt.Value + Resource.PurgeAfter))];
    }

    private async Task<Result> ChangeAsync(Guid id, bool archive, CancellationToken cancellationToken)
    {
        var caller = await access.CallerAsync(cancellationToken);
        var resource = await access.FindAsync(id, caller, cancellationToken);
        if (resource is null)
        {
            return Result.NotFound();
        }

        if (!access.CanChange(resource, caller))
        {
            return Result.Forbidden();
        }

        if (resource.IsArchived == archive)
        {
            return Result.Conflict(archive ? "It’s already archived." : "It isn’t archived.");
        }

        if (archive)
        {
            resource.Archive(time.GetUtcNow());
        }
        else
        {
            resource.Restore();
        }

        if (access.IsOverride(resource, caller))
        {
            audit.Record(caller, archive ? "resource.archived" : "resource.restored", nameof(Resource), resource.Id.ToString(), null, new { resource.Title });
        }

        await db.SaveChangesAsync(cancellationToken);
        return Result.Ok();
    }
}
